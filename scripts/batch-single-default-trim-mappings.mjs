/**
 * Batch Single-Default Trim Mapping Creator
 * 
 * SAFE: Creates pending trim mappings only for vehicles with a single identifiable
 * OEM configuration. NO API calls. NO auto-approval.
 * 
 * Rules:
 * 1. Only process vehicles where ALL records for that YMM have the same wheel diameter
 * 2. Create mappings as pending (status="pending", needsReview=true)
 * 3. Set hasSingleConfig=true, default wheel diameter and tire size
 * 4. Preserve customer-facing trim labels
 * 5. Skip any vehicle with multiple wheel diameters
 * 6. Audit log all results
 * 
 * Run: node scripts/batch-single-default-trim-mappings.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Track stats
const stats = {
  totalCandidatesAnalyzed: 0,
  mappingsCreated: 0,
  skippedMultiDiameter: 0,
  skippedAmbiguous: 0,
  skippedAlreadyMapped: 0,
  skippedNoTireData: 0,
  skippedTrimTireVariance: 0,
  confidenceBreakdown: {
    high: 0,
    medium: 0,
  },
  makeBreakdown: {},
  trimTireVarianceExclusions: [], // Track excluded vehicles
  errors: [],
};

/**
 * Extract wheel diameter from wheel size string or object
 */
function extractDiameter(wheelSize) {
  if (!wheelSize) return null;
  
  // Object format: {diameter: 18, width: 8.5}
  if (typeof wheelSize === 'object' && wheelSize.diameter) {
    return parseInt(wheelSize.diameter);
  }
  
  // String format: "8.5Jx18" or "8.5x18" or "18x8.5"
  if (typeof wheelSize === 'string') {
    // Pattern: xDD at end (e.g., "8.5Jx18", "8.5x18")
    let match = wheelSize.match(/x(\d+)/i);
    if (match) return parseInt(match[1]);
    
    // Pattern: DD" (e.g., "18\"")
    match = wheelSize.match(/^(\d+)/);
    if (match && parseInt(match[1]) >= 14 && parseInt(match[1]) <= 26) {
      return parseInt(match[1]);
    }
  }
  
  return null;
}

/**
 * Extract diameter from tire size (e.g., "275/65R18" -> 18)
 */
function extractTireDiameter(tireSize) {
  if (!tireSize || typeof tireSize !== 'string') return null;
  const match = tireSize.match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Parse OEM sizes from JSON or array
 */
function parseOemSizes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Normalize tire size for comparison (strip ZR vs R, etc)
 */
function normalizeTireSize(size) {
  if (!size || typeof size !== 'string') return '';
  return size.replace('ZR', 'R').replace('z', '').toLowerCase().trim();
}

/**
 * Analyze a vehicle group and determine if it has a single default config
 */
function analyzeVehicleGroup(records) {
  const allDiameters = new Set();
  const allTireSizes = new Set();
  const diameterCounts = {};
  const tireSizeCounts = {};
  const trimTireMap = {}; // Track tire sizes per trim
  
  for (const record of records) {
    const trim = record.display_trim || 'Base';
    const wheelSizes = parseOemSizes(record.oem_wheel_sizes);
    const tireSizes = parseOemSizes(record.oem_tire_sizes);
    
    // Initialize trim tracking
    if (!trimTireMap[trim]) {
      trimTireMap[trim] = new Set();
    }
    
    // Extract wheel diameters
    for (const ws of wheelSizes) {
      const dia = extractDiameter(ws);
      if (dia) {
        allDiameters.add(dia);
        diameterCounts[dia] = (diameterCounts[dia] || 0) + 1;
      }
    }
    
    // Extract tire diameters and track per trim
    for (const ts of tireSizes) {
      const dia = extractTireDiameter(ts);
      if (dia) {
        allDiameters.add(dia);
        diameterCounts[dia] = (diameterCounts[dia] || 0) + 1;
      }
      if (typeof ts === 'string') {
        allTireSizes.add(ts);
        tireSizeCounts[ts] = (tireSizeCounts[ts] || 0) + 1;
        // Track normalized tire size per trim
        trimTireMap[trim].add(normalizeTireSize(ts));
      }
    }
  }
  
  const uniqueDiameters = [...allDiameters].sort((a, b) => a - b);
  const uniqueTireSizes = [...allTireSizes];
  const trims = Object.keys(trimTireMap);
  
  // Check if single default is identifiable
  if (uniqueDiameters.length === 0) {
    return { singleDefaultIdentifiable: false, reason: 'no_wheel_data' };
  }
  
  if (uniqueDiameters.length > 1) {
    return { singleDefaultIdentifiable: false, reason: 'multi_diameter', diameters: uniqueDiameters };
  }
  
  // Single diameter - check for TRIM_TIRE_VARIANCE
  // This is a REAL issue where different trims have different tire specs
  if (trims.length > 1) {
    const trimTireSets = trims
      .map(trim => ({
        trim,
        // Create a normalized signature of tire sizes for this trim
        signature: [...trimTireMap[trim]].filter(t => t).sort().join('|'),
      }))
      .filter(t => t.signature); // Only trims with tire data
    
    const uniqueSignatures = new Set(trimTireSets.map(t => t.signature));
    
    if (uniqueSignatures.size > 1) {
      // Different trims have different tire configs - EXCLUDE
      const examples = trimTireSets.slice(0, 3).map(t => {
        const firstTire = [...trimTireMap[t.trim]][0] || 'unknown';
        return `${t.trim}: ${firstTire}`;
      });
      return { 
        singleDefaultIdentifiable: false, 
        reason: 'trim_tire_variance',
        trimVarianceDetails: examples.join(', '),
        trims,
      };
    }
  }
  
  // Single diameter, no trim variance - this is a candidate!
  const singleDiameter = uniqueDiameters[0];
  
  // Find the most common tire size for this diameter
  let defaultTireSize = null;
  let maxCount = 0;
  for (const [size, count] of Object.entries(tireSizeCounts)) {
    if (extractTireDiameter(size) === singleDiameter && count > maxCount) {
      defaultTireSize = size;
      maxCount = count;
    }
  }
  
  // Determine confidence
  let confidence = 'high';
  let confidenceReason = '';
  
  // Check if all records agree
  const recordCount = records.length;
  const diameterOccurrences = diameterCounts[singleDiameter] || 0;
  
  if (diameterOccurrences < recordCount * 0.8) {
    confidence = 'medium';
    confidenceReason = 'not_all_records_have_diameter';
  }
  
  if (!defaultTireSize) {
    confidence = 'medium';
    confidenceReason = 'no_tire_size_found';
  }
  
  return {
    singleDefaultIdentifiable: true,
    diameter: singleDiameter,
    defaultTireSize,
    allTireSizes: uniqueTireSizes,
    confidence,
    confidenceReason,
    recordCount,
    trims,
  };
}

/**
 * Main batch processor
 */
async function createBatchMappings(dryRun = true, limit = null) {
  const client = await pool.connect();
  
  console.log("═".repeat(80));
  console.log("BATCH SINGLE-DEFAULT TRIM MAPPING CREATOR");
  console.log("═".repeat(80));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '✏️ LIVE (will create mappings)'}`);
  if (limit) {
    console.log(`Limit: ${limit} mappings`);
  }
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log("═".repeat(80));
  console.log("");
  
  try {
    // =========================================================================
    // Step 1: Get all certified fitments grouped by YMM
    // =========================================================================
    
    console.log("Step 1: Querying certified vehicle fitments...");
    
    const query = `
      SELECT 
        vf.id,
        vf.year,
        vf.make,
        vf.model,
        vf.display_trim,
        vf.modification_id,
        vf.source,
        vf.oem_wheel_sizes,
        vf.oem_tire_sizes,
        vf.bolt_pattern,
        vf.center_bore_mm
      FROM vehicle_fitments vf
      WHERE vf.year >= 2020
        AND vf.certification_status = 'certified'
      ORDER BY vf.year DESC, vf.make, vf.model, vf.display_trim
    `;
    
    const result = await client.query(query);
    console.log(`Found ${result.rows.length} certified fitment records`);
    
    // =========================================================================
    // Step 2: Group by YMM (Year/Make/Model)
    // =========================================================================
    
    console.log("\nStep 2: Grouping by Year/Make/Model...");
    
    const ymmGroups = {};
    for (const row of result.rows) {
      const key = `${row.year}|${row.make}|${row.model}`;
      if (!ymmGroups[key]) {
        ymmGroups[key] = {
          year: row.year,
          make: row.make,
          model: row.model,
          records: [],
        };
      }
      ymmGroups[key].records.push(row);
    }
    
    const totalYMM = Object.keys(ymmGroups).length;
    console.log(`Grouped into ${totalYMM} unique Year/Make/Model combinations`);
    
    // =========================================================================
    // Step 3: Analyze each group and identify single-default candidates
    // =========================================================================
    
    console.log("\nStep 3: Analyzing for single-default candidates...");
    
    const candidates = [];
    
    for (const [key, group] of Object.entries(ymmGroups)) {
      stats.totalCandidatesAnalyzed++;
      
      const analysis = analyzeVehicleGroup(group.records);
      
      if (analysis.singleDefaultIdentifiable) {
        candidates.push({
          ...group,
          ...analysis,
        });
      } else {
        if (analysis.reason === 'multi_diameter') {
          stats.skippedMultiDiameter++;
        } else if (analysis.reason === 'no_wheel_data') {
          stats.skippedNoTireData++;
        } else if (analysis.reason === 'trim_tire_variance') {
          stats.skippedTrimTireVariance++;
          stats.trimTireVarianceExclusions.push({
            year: group.year,
            make: group.make,
            model: group.model,
            trims: analysis.trims,
            details: analysis.trimVarianceDetails,
          });
        } else {
          stats.skippedAmbiguous++;
        }
      }
    }
    
    console.log(`\nSingle-default candidates identified: ${candidates.length}`);
    console.log(`Skipped (multi-diameter): ${stats.skippedMultiDiameter}`);
    console.log(`Skipped (no wheel data): ${stats.skippedNoTireData}`);
    console.log(`Skipped (TRIM_TIRE_VARIANCE): ${stats.skippedTrimTireVariance}`);
    console.log(`Skipped (ambiguous): ${stats.skippedAmbiguous}`);
    
    // =========================================================================
    // Step 4: Create pending trim mappings
    // =========================================================================
    
    console.log("\nStep 4: Creating pending trim mappings...");
    
    const batchId = randomUUID();
    const createdMappings = [];
    
    for (const candidate of candidates) {
      // Check limit
      if (limit && stats.mappingsCreated >= limit) {
        console.log(`\n⚠️  Reached limit of ${limit} mappings. Stopping.`);
        break;
      }
      
      // Process each trim within this YMM
      for (const record of candidate.records) {
        // Check limit again inside inner loop
        if (limit && stats.mappingsCreated >= limit) {
          break;
        }
        
        const trimLabel = record.display_trim || 'Base';
        
        // Check if mapping already exists
        const existsCheck = await client.query(`
          SELECT id FROM wheel_size_trim_mappings
          WHERE year = $1 AND make = $2 AND model = $3 AND our_trim = $4
        `, [candidate.year, candidate.make, candidate.model, trimLabel]);
        
        if (existsCheck.rows.length > 0) {
          stats.skippedAlreadyMapped++;
          continue;
        }
        
        // Create the mapping
        const mapping = {
          id: randomUUID(),
          year: candidate.year,
          make: candidate.make,
          model: candidate.model,
          ourTrim: trimLabel,
          ourModificationId: record.modification_id,
          vehicleFitmentId: record.id,
          wsSlug: record.modification_id, // Use our modificationId as placeholder
          wsModificationName: `${candidate.year} ${candidate.make} ${candidate.model} ${trimLabel}`,
          matchMethod: 'single_default_batch',
          matchConfidence: candidate.confidence,
          matchScore: candidate.confidence === 'high' ? 0.95 : 0.85,
          configCount: 1,
          hasSingleConfig: true,
          defaultWheelDiameter: candidate.diameter,
          defaultTireSize: candidate.defaultTireSize,
          allWheelDiameters: [candidate.diameter],
          allTireSizes: candidate.allTireSizes,
          needsReview: true,
          reviewReason: `Single-default batch import (batch: ${batchId.slice(0, 8)})`,
          reviewPriority: candidate.confidence === 'high' ? 0 : 1,
          status: 'pending',
        };
        
        if (!dryRun) {
          await client.query(`
            INSERT INTO wheel_size_trim_mappings (
              id, year, make, model, our_trim, our_modification_id, vehicle_fitment_id,
              ws_slug, ws_modification_name,
              match_method, match_confidence, match_score,
              config_count, has_single_config,
              default_wheel_diameter, default_tire_size,
              all_wheel_diameters, all_tire_sizes,
              needs_review, review_reason, review_priority,
              status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9,
              $10, $11, $12,
              $13, $14,
              $15, $16,
              $17, $18,
              $19, $20, $21,
              $22, NOW(), NOW()
            )
          `, [
            mapping.id, mapping.year, mapping.make, mapping.model, mapping.ourTrim,
            mapping.ourModificationId, mapping.vehicleFitmentId,
            mapping.wsSlug, mapping.wsModificationName,
            mapping.matchMethod, mapping.matchConfidence, mapping.matchScore,
            mapping.configCount, mapping.hasSingleConfig,
            mapping.defaultWheelDiameter, mapping.defaultTireSize,
            mapping.allWheelDiameters, mapping.allTireSizes,
            mapping.needsReview, mapping.reviewReason, mapping.reviewPriority,
            mapping.status,
          ]);
        }
        
        createdMappings.push(mapping);
        stats.mappingsCreated++;
        stats.confidenceBreakdown[mapping.matchConfidence]++;
        
        // Track by make
        stats.makeBreakdown[candidate.make] = (stats.makeBreakdown[candidate.make] || 0) + 1;
      }
    }
    
    // =========================================================================
    // Step 5: Output results
    // =========================================================================
    
    console.log("\n");
    console.log("═".repeat(80));
    console.log("BATCH RESULTS");
    console.log("═".repeat(80));
    console.log("");
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '✅ LIVE'}`);
    console.log(`Batch ID: ${batchId}`);
    console.log("");
    console.log(`Total YMM combinations analyzed: ${stats.totalCandidatesAnalyzed}`);
    console.log(`Single-default candidates: ${candidates.length}`);
    console.log("");
    console.log("─".repeat(40));
    console.log("RESULTS:");
    console.log("─".repeat(40));
    console.log(`✅ Mappings created: ${stats.mappingsCreated}`);
    console.log(`⏭️ Skipped (already mapped): ${stats.skippedAlreadyMapped}`);
    console.log(`🚫 Skipped (multi-diameter): ${stats.skippedMultiDiameter}`);
    console.log(`❓ Skipped (no wheel data): ${stats.skippedNoTireData}`);
    console.log(`🔴 Skipped (TRIM_TIRE_VARIANCE): ${stats.skippedTrimTireVariance}`);
    console.log(`⚠️ Skipped (ambiguous): ${stats.skippedAmbiguous}`);
    console.log("");
    console.log("─".repeat(40));
    console.log("CONFIDENCE BREAKDOWN:");
    console.log("─".repeat(40));
    console.log(`🟢 High confidence: ${stats.confidenceBreakdown.high}`);
    console.log(`🟡 Medium confidence: ${stats.confidenceBreakdown.medium}`);
    console.log("");
    console.log("─".repeat(40));
    console.log("TOP MAKES PROCESSED:");
    console.log("─".repeat(40));
    
    const sortedMakes = Object.entries(stats.makeBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    for (const [make, count] of sortedMakes) {
      console.log(`  ${make}: ${count}`);
    }
    
    console.log("");
    console.log("═".repeat(80));
    
    if (dryRun) {
      console.log("⚠️  DRY RUN COMPLETE - No changes made to database");
      console.log("   Run with --live to create mappings");
    } else {
      console.log("✅ BATCH COMPLETE - Pending mappings created");
      console.log("   All mappings require admin review before activation");
    }
    
    console.log("═".repeat(80));
    
    // Output sample mappings
    if (createdMappings.length > 0) {
      console.log("\n");
      console.log("─".repeat(40));
      console.log("SAMPLE MAPPINGS (first 10):");
      console.log("─".repeat(40));
      
      for (const m of createdMappings.slice(0, 10)) {
        console.log(`  ${m.year} ${m.make} ${m.model} ${m.ourTrim}`);
        console.log(`    → Diameter: ${m.defaultWheelDiameter}", Tire: ${m.defaultTireSize || 'any'}`);
        console.log(`    → Confidence: ${m.matchConfidence}, Status: ${m.status}`);
        console.log("");
      }
    }
    
    // Output TRIM_TIRE_VARIANCE exclusions (up to 10)
    if (stats.trimTireVarianceExclusions.length > 0) {
      console.log("\n");
      console.log("─".repeat(40));
      console.log(`EXCLUDED: TRIM_TIRE_VARIANCE (${stats.trimTireVarianceExclusions.length} vehicles):`);
      console.log("─".repeat(40));
      
      for (const ex of stats.trimTireVarianceExclusions.slice(0, 10)) {
        console.log(`  🔴 ${ex.year} ${ex.make} ${ex.model}`);
        console.log(`     Trims: ${ex.trims.join(', ')}`);
        console.log(`     Variance: ${ex.details}`);
        console.log("");
      }
      
      if (stats.trimTireVarianceExclusions.length > 10) {
        console.log(`  ... and ${stats.trimTireVarianceExclusions.length - 10} more`);
      }
    }
    
    return {
      batchId,
      stats,
      mappingsCreated: createdMappings.length,
      dryRun,
    };
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Parse arguments
const isLive = process.argv.includes('--live');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

createBatchMappings(!isLive, limit)
  .then(result => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch(err => {
    console.error("\n❌ ERROR:", err);
    process.exit(1);
  });
