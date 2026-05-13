#!/usr/bin/env node
/**
 * Extract USAF vehicle data from existing batch audit files
 * and perform missing vehicle analysis
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

const BATCH_DIR = path.join(process.cwd(), 'scripts/usaf-audit-results');

// =============================================================================
// ALIAS NORMALIZATION
// =============================================================================

const MAKE_ALIASES = {
  'chevy': 'chevrolet',
  'vw': 'volkswagen',
  'mercedes': 'mercedes-benz',
  'mercedes benz': 'mercedes-benz',
  'dodge ram': 'ram',
  'landrover': 'land rover',
  'land-rover': 'land rover',
  'alfa': 'alfa romeo',
  'aston': 'aston martin',
  'rolls': 'rolls-royce',
  'rolls royce': 'rolls-royce',
};

function normalizeMake(make) {
  if (!make) return '';
  const lower = make.toLowerCase().trim();
  return MAKE_ALIASES[lower] || lower;
}

function normalizeModel(model) {
  if (!model) return '';
  return model.toLowerCase().trim().replace(/\s+/g, ' ');
}

function createVehicleKey(year, make, model) {
  return `${year}|${normalizeMake(make)}|${normalizeModel(model)}`;
}

// =============================================================================
// LOAD BATCH DATA
// =============================================================================

function loadBatchFiles() {
  const allVehicleData = {
    safeAutoFixes: [],
    legacyFallbackEnrichments: [],
    configTableCandidates: [],
    manualReviewRequired: [],
    summaries: [],
  };
  
  for (let i = 1; i <= 10; i++) {
    const f = `batch-${String(i).padStart(2, '0')}.json`;
    const filePath = path.join(BATCH_DIR, f);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      allVehicleData.summaries.push({
        batch: i,
        ...data.summary
      });
      
      if (data.safeAutoFixes) {
        allVehicleData.safeAutoFixes.push(...data.safeAutoFixes);
      }
      if (data.legacyFallbackEnrichments) {
        allVehicleData.legacyFallbackEnrichments.push(...data.legacyFallbackEnrichments);
      }
      if (data.configTableCandidates) {
        allVehicleData.configTableCandidates.push(...data.configTableCandidates);
      }
      if (data.manualReviewRequired) {
        allVehicleData.manualReviewRequired.push(...data.manualReviewRequired);
      }
    }
  }
  
  return allVehicleData;
}

// =============================================================================
// EXTRACT UNIQUE VEHICLES
// =============================================================================

function extractUniqueVehicles(batchData) {
  const vehicles = new Map();
  
  const allItems = [
    ...batchData.safeAutoFixes,
    ...batchData.legacyFallbackEnrichments,
    ...batchData.configTableCandidates,
    ...batchData.manualReviewRequired,
  ];
  
  for (const item of allItems) {
    const key = createVehicleKey(item.year, item.make, item.model);
    
    if (!vehicles.has(key)) {
      vehicles.set(key, {
        year: item.year,
        make: item.make,
        model: item.model,
        existingWtdSizes: item.existingWtdSizes || [],
        existingUsafSizes: item.existingUsafSizes || [],
        existingDiameters: item.existingDiameters || [],
        vehicleFlags: item.vehicleFlags || {},
        categories: new Set(),
      });
    }
    
    const v = vehicles.get(key);
    
    // Track which categories this vehicle appears in
    if (batchData.safeAutoFixes.includes(item)) v.categories.add('safeAutoFix');
    if (batchData.legacyFallbackEnrichments.includes(item)) v.categories.add('legacyFallback');
    if (batchData.configTableCandidates.includes(item)) v.categories.add('configCandidate');
    if (batchData.manualReviewRequired.includes(item)) v.categories.add('manualReview');
    
    // Merge tire sizes
    for (const s of (item.existingUsafSizes || [])) {
      if (!v.existingUsafSizes.includes(s)) {
        v.existingUsafSizes.push(s);
      }
    }
  }
  
  // Convert categories Set to array
  for (const v of vehicles.values()) {
    v.categories = [...v.categories];
  }
  
  return vehicles;
}

// =============================================================================
// WTD QUERIES
// =============================================================================

async function getWTDVehicles() {
  const result = await pool.query(`
    SELECT DISTINCT ON (year, LOWER(make), LOWER(model))
      year, make, model, bolt_pattern, center_bore_mm, 
      oem_tire_sizes, oem_wheel_sizes, quality_tier
    FROM vehicle_fitments
    WHERE year >= 2000 AND year <= 2026
    ORDER BY year, LOWER(make), LOWER(model), quality_tier DESC NULLS LAST
  `);
  return result.rows;
}

async function findSiblingPlatform(year, make, model) {
  const result = await pool.query(`
    SELECT DISTINCT model, bolt_pattern, center_bore_mm
    FROM vehicle_fitments
    WHERE year = $1 
      AND LOWER(make) = LOWER($2)
      AND bolt_pattern IS NOT NULL
    LIMIT 10
  `, [year, make]);
  return result.rows;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('COVERAGE AUDIT: Extract & Analyze from Batch Files');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  // Load batch data
  console.log('Loading batch audit files...');
  const batchData = loadBatchFiles();
  
  console.log('\nBatch Summaries:');
  let totalExact = 0, totalPartial = 0, totalWtdOnly = 0, totalUsafOnly = 0;
  for (const s of batchData.summaries) {
    console.log(`  Batch ${s.batch}: ${s.totalVehicles} vehicles | exact: ${s.exactMatch} | partial: ${s.partialMatch} | wtdOnly: ${s.wtdOnly} | usafOnly: ${s.usafOnly}`);
    totalExact += s.exactMatch || 0;
    totalPartial += s.partialMatch || 0;
    totalWtdOnly += s.wtdOnly || 0;
    totalUsafOnly += s.usafOnly || 0;
  }
  
  console.log(`\nTotals across batches:`);
  console.log(`  Exact match: ${totalExact}`);
  console.log(`  Partial match: ${totalPartial}`);
  console.log(`  WTD-only: ${totalWtdOnly}`);
  console.log(`  USAF-only: ${totalUsafOnly}`);
  
  // Extract unique vehicles
  console.log('\nExtracting unique vehicles from all items...');
  const usafVehicles = extractUniqueVehicles(batchData);
  console.log(`Unique USAF vehicles with enrichment data: ${usafVehicles.size}`);
  
  // Load WTD vehicles
  console.log('\nLoading WTD vehicles...');
  const wtdVehicles = await getWTDVehicles();
  console.log(`WTD vehicles: ${wtdVehicles.length}`);
  
  // Create WTD lookup
  const wtdByKey = new Map();
  for (const v of wtdVehicles) {
    const key = createVehicleKey(v.year, v.make, v.model);
    wtdByKey.set(key, v);
  }
  
  // Analyze coverage
  const results = {
    wtdTotal: wtdVehicles.length,
    usafWithEnrichmentData: usafVehicles.size,
    coverage: {
      exactMatch: 0,
      partialMatch: 0,
      usafOnlyWithSiblings: [],
      usafOnlyNoSiblings: [],
      aliasMismatches: [],
    },
    wheelSpecConfidence: {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      MISSING_SPECS: 0,
    },
    lowestConfidenceVehicles: [],
  };
  
  // Analyze each USAF vehicle
  console.log('\nAnalyzing USAF vehicles...\n');
  
  for (const [key, usafV] of usafVehicles) {
    const wtdV = wtdByKey.get(key);
    
    if (wtdV) {
      // Vehicle exists in both
      if (usafV.existingWtdSizes.length > 0 && usafV.existingUsafSizes.length > 0) {
        const wtdSet = new Set(usafV.existingWtdSizes.map(s => s.toLowerCase()));
        const usafSet = new Set(usafV.existingUsafSizes.map(s => s.toLowerCase()));
        const intersection = [...wtdSet].filter(s => usafSet.has(s));
        
        if (intersection.length === usafSet.size) {
          results.coverage.exactMatch++;
        } else {
          results.coverage.partialMatch++;
        }
      }
      
      // Assess wheel spec confidence
      if (wtdV.bolt_pattern && wtdV.center_bore_mm) {
        if (wtdV.oem_wheel_sizes && wtdV.oem_wheel_sizes.length > 0) {
          results.wheelSpecConfidence.HIGH++;
        } else {
          results.wheelSpecConfidence.MEDIUM++;
        }
      } else if (wtdV.bolt_pattern || wtdV.center_bore_mm) {
        results.wheelSpecConfidence.LOW++;
        results.lowestConfidenceVehicles.push({
          vehicle: `${usafV.year} ${usafV.make} ${usafV.model}`,
          boltPattern: wtdV.bolt_pattern,
          centerBore: wtdV.center_bore_mm,
          issue: 'Incomplete wheel specs',
        });
      } else {
        results.wheelSpecConfidence.MISSING_SPECS++;
        results.lowestConfidenceVehicles.push({
          vehicle: `${usafV.year} ${usafV.make} ${usafV.model}`,
          boltPattern: null,
          centerBore: null,
          issue: 'No wheel specs',
        });
      }
    } else {
      // USAF-only - check for siblings
      const siblings = await findSiblingPlatform(usafV.year, usafV.make, usafV.model);
      
      if (siblings.length > 0) {
        const boltPatterns = [...new Set(siblings.map(s => s.bolt_pattern).filter(Boolean))];
        results.coverage.usafOnlyWithSiblings.push({
          year: usafV.year,
          make: usafV.make,
          model: usafV.model,
          usafTireSizes: usafV.existingUsafSizes,
          siblingCount: siblings.length,
          siblingModels: siblings.slice(0, 3).map(s => s.model),
          inferredBoltPattern: boltPatterns.length === 1 ? boltPatterns[0] : null,
          canInfer: boltPatterns.length === 1,
        });
      } else {
        results.coverage.usafOnlyNoSiblings.push({
          year: usafV.year,
          make: usafV.make,
          model: usafV.model,
          usafTireSizes: usafV.existingUsafSizes,
        });
      }
    }
  }
  
  // Sort and limit lowest confidence
  results.lowestConfidenceVehicles = results.lowestConfidenceVehicles.slice(0, 100);
  
  // Sort USAF-only by potential (has tire sizes and siblings)
  results.coverage.usafOnlyWithSiblings.sort((a, b) => {
    if (a.canInfer && !b.canInfer) return -1;
    if (!a.canInfer && b.canInfer) return 1;
    return b.usafTireSizes.length - a.usafTireSizes.length;
  });
  
  // Output
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('COVERAGE AUDIT RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  console.log(`Total WTD vehicles (2000-current): ${results.wtdTotal}`);
  console.log(`USAF vehicles with enrichment data: ${results.usafWithEnrichmentData}`);
  
  console.log('\n📊 Coverage:');
  console.log(`  Exact match (all USAF sizes in WTD): ${results.coverage.exactMatch}`);
  console.log(`  Partial match (some USAF sizes in WTD): ${results.coverage.partialMatch}`);
  console.log(`  USAF-only with siblings: ${results.coverage.usafOnlyWithSiblings.length}`);
  console.log(`  USAF-only no siblings: ${results.coverage.usafOnlyNoSiblings.length}`);
  
  console.log('\n🎯 Wheel Spec Confidence:');
  console.log(`  HIGH (bolt + CB + wheel sizes): ${results.wheelSpecConfidence.HIGH}`);
  console.log(`  MEDIUM (bolt + CB, no wheel sizes): ${results.wheelSpecConfidence.MEDIUM}`);
  console.log(`  LOW (incomplete specs): ${results.wheelSpecConfidence.LOW}`);
  console.log(`  MISSING (no wheel specs): ${results.wheelSpecConfidence.MISSING_SPECS}`);
  
  // Top missing vehicles
  if (results.coverage.usafOnlyWithSiblings.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('TOP 50 CANDIDATE MISSING VEHICLES (Have Siblings)');
    console.log('───────────────────────────────────────────────────────────────────────\n');
    
    for (const v of results.coverage.usafOnlyWithSiblings.slice(0, 50)) {
      console.log(`${v.year} ${v.make} ${v.model}`);
      if (v.usafTireSizes.length > 0) {
        console.log(`  USAF tires: ${v.usafTireSizes.slice(0, 3).join(', ')}${v.usafTireSizes.length > 3 ? '...' : ''}`);
      }
      console.log(`  Siblings: ${v.siblingModels.join(', ')} (${v.siblingCount} total)`);
      if (v.inferredBoltPattern) {
        console.log(`  Can infer: ${v.inferredBoltPattern}`);
      }
      console.log('');
    }
  }
  
  // Lowest confidence vehicles
  if (results.lowestConfidenceVehicles.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('TOP 50 LOWEST CONFIDENCE WHEEL SPEC VEHICLES');
    console.log('───────────────────────────────────────────────────────────────────────\n');
    
    for (const v of results.lowestConfidenceVehicles.slice(0, 50)) {
      console.log(`${v.vehicle}`);
      console.log(`  Bolt: ${v.boltPattern || 'MISSING'} | CB: ${v.centerBore || 'MISSING'}`);
      console.log(`  Issue: ${v.issue}`);
      console.log('');
    }
  }
  
  // Save results
  const outputPath = path.join(__dirname, 'coverage-audit-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      wtdTotal: results.wtdTotal,
      usafWithEnrichmentData: results.usafWithEnrichmentData,
      exactMatch: results.coverage.exactMatch,
      partialMatch: results.coverage.partialMatch,
      usafOnlyWithSiblings: results.coverage.usafOnlyWithSiblings.length,
      usafOnlyNoSiblings: results.coverage.usafOnlyNoSiblings.length,
      wheelSpecHigh: results.wheelSpecConfidence.HIGH,
      wheelSpecMedium: results.wheelSpecConfidence.MEDIUM,
      wheelSpecLow: results.wheelSpecConfidence.LOW,
      wheelSpecMissing: results.wheelSpecConfidence.MISSING_SPECS,
    },
    candidateMissingVehicles: results.coverage.usafOnlyWithSiblings.slice(0, 100),
    usafOnlyNoSiblings: results.coverage.usafOnlyNoSiblings.slice(0, 100),
    lowestConfidenceVehicles: results.lowestConfidenceVehicles,
  }, null, 2));
  
  console.log(`\n📄 Full results saved: ${outputPath}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
