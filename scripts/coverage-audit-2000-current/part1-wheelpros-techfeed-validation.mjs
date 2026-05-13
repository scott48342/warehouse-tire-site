#!/usr/bin/env node
/**
 * PART 1: WheelPros Techfeed Wheel Spec Validation
 * 
 * Validates WTD wheel specs against WheelPros techfeed data.
 * Uses local techfeed index instead of live API.
 * 
 * NO DB WRITES - Audit only.
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

// =============================================================================
// WTD QUERIES
// =============================================================================

async function getWTDVehicles(limit = null) {
  const query = `
    SELECT DISTINCT ON (year, LOWER(make), LOWER(model))
      year, make, model, bolt_pattern, center_bore_mm,
      offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
      quality_tier
    FROM vehicle_fitments
    WHERE year >= 2000 AND year <= 2026
      AND bolt_pattern IS NOT NULL
    ORDER BY year, LOWER(make), LOWER(model), quality_tier DESC NULLS LAST
    ${limit ? `LIMIT ${limit}` : ''}
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

async function getTechfeedWheelsByBoltPattern(boltPattern) {
  // Normalize bolt pattern - WTD uses "5x114.3", WheelPros uses "5X114.3"
  const normalized = boltPattern.toUpperCase();
  
  // Query the wp_wheels table - bolt_pattern_metric contains patterns like "5X114.3"
  // Need to match both single and dual patterns (e.g., "5X139.7/5X150")
  const result = await pool.query(`
    SELECT DISTINCT
      sku, diameter_in, width_in, offset_mm, centerbore_mm, bolt_pattern_metric
    FROM wp_wheels
    WHERE UPPER(bolt_pattern_metric) LIKE $1
       OR UPPER(bolt_pattern_metric) LIKE $2
    LIMIT 200
  `, [`%${normalized}%`, `${normalized}/%`]);
  
  return result.rows.map(r => ({
    sku: r.sku,
    diameter: parseFloat(r.diameter_in),
    width: parseFloat(r.width_in),
    offset_value: parseFloat(r.offset_mm),
    center_bore: parseFloat(r.centerbore_mm),
    bolt_pattern: r.bolt_pattern_metric,
  }));
}

async function getTechfeedBoltPatternStats() {
  const result = await pool.query(`
    SELECT bolt_pattern_metric as bolt_pattern, COUNT(*) as wheel_count
    FROM wp_wheels
    WHERE bolt_pattern_metric IS NOT NULL
    GROUP BY bolt_pattern_metric
    ORDER BY wheel_count DESC
  `);
  return result.rows;
}

// =============================================================================
// SPEC EXTRACTION
// =============================================================================

function extractWheelDiameters(oemWheelSizes) {
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) return [];
  
  const diameters = new Set();
  for (const ws of oemWheelSizes) {
    if (typeof ws === 'number') {
      diameters.add(ws);
    } else if (typeof ws === 'object' && ws.diameter) {
      diameters.add(ws.diameter);
    } else if (typeof ws === 'string') {
      const match = ws.match(/(\d+)/);
      if (match) diameters.add(parseInt(match[1], 10));
    }
  }
  return [...diameters].sort((a, b) => a - b);
}

function parseBoltPattern(bp) {
  if (!bp) return null;
  
  const match = bp.match(/(\d+)x([\d.]+)/i);
  if (!match) return null;
  
  const lugs = parseInt(match[1], 10);
  let pcd = parseFloat(match[2]);
  
  if (pcd < 50) {
    pcd = pcd * 25.4;
  }
  
  return { lugs, pcd: Math.round(pcd * 10) / 10 };
}

// =============================================================================
// VALIDATION LOGIC
// =============================================================================

function validateSpec(wtdVehicle, techfeedWheels) {
  const issues = [];
  const confidenceFactors = [];
  
  const wtdCB = wtdVehicle.center_bore_mm;
  const wtdOffsetMin = wtdVehicle.offset_min_mm;
  const wtdOffsetMax = wtdVehicle.offset_max_mm;
  const wtdDiameters = extractWheelDiameters(wtdVehicle.oem_wheel_sizes);
  
  if (techfeedWheels.length === 0) {
    return {
      confidence: 'LOW',
      issues: ['No techfeed wheels found for bolt pattern'],
      wheelCount: 0,
      confidenceFactors: [],
    };
  }
  
  // Analyze techfeed wheels
  const tfCenterBores = new Set();
  const tfOffsets = new Set();
  const tfDiameters = new Set();
  const tfWidths = new Set();
  
  for (const wheel of techfeedWheels) {
    if (wheel.center_bore) tfCenterBores.add(parseFloat(wheel.center_bore));
    if (wheel.offset_value) tfOffsets.add(parseFloat(wheel.offset_value));
    if (wheel.diameter) tfDiameters.add(parseInt(wheel.diameter, 10));
    if (wheel.width) tfWidths.add(parseFloat(wheel.width));
  }
  
  // Check center bore
  if (wtdCB && tfCenterBores.size > 0) {
    const maxTfCB = Math.max(...tfCenterBores);
    const minTfCB = Math.min(...tfCenterBores);
    
    if (wtdCB > maxTfCB + 1) {
      issues.push(`HUB_RISK: WTD CB ${wtdCB}mm > max techfeed CB ${maxTfCB}mm`);
    } else if (wtdCB < minTfCB - 5) {
      issues.push(`CB_TOO_SMALL: WTD CB ${wtdCB}mm < min techfeed CB ${minTfCB}mm`);
    } else {
      confidenceFactors.push('center_bore_valid');
    }
  }
  
  // Check offset range
  if (wtdOffsetMin !== null && wtdOffsetMax !== null && tfOffsets.size > 0) {
    const minTfOffset = Math.min(...tfOffsets);
    const maxTfOffset = Math.max(...tfOffsets);
    
    // WTD range should encompass common techfeed offsets
    if (wtdOffsetMin > minTfOffset + 10) {
      issues.push(`OFFSET_RANGE_TOO_STRICT: WTD min ${wtdOffsetMin} vs TF min ${minTfOffset}`);
    }
    if (wtdOffsetMax < maxTfOffset - 10) {
      issues.push(`OFFSET_RANGE_TOO_STRICT: WTD max ${wtdOffsetMax} vs TF max ${maxTfOffset}`);
    }
    
    if (!issues.some(i => i.includes('OFFSET'))) {
      confidenceFactors.push('offset_range_valid');
    }
  }
  
  // Check diameters
  if (wtdDiameters.length > 0 && tfDiameters.size > 0) {
    const missingDiams = wtdDiameters.filter(d => !tfDiameters.has(d));
    if (missingDiams.length > 0) {
      issues.push(`DIAMETER_NOT_IN_TECHFEED: ${missingDiams.join(', ')}`);
    }
    
    const extraDiams = [...tfDiameters].filter(d => 
      !wtdDiameters.includes(d) && d >= 15 && d <= 24
    );
    if (extraDiams.length > 0) {
      // This is informational, not an issue
      confidenceFactors.push('additional_diameters_available');
    }
    
    if (missingDiams.length === 0) {
      confidenceFactors.push('diameters_match');
    }
  }
  
  // Calculate confidence
  let confidence;
  const hasHubRisk = issues.some(i => i.includes('HUB_RISK'));
  const hasStrictRange = issues.some(i => i.includes('TOO_STRICT'));
  
  if (hasHubRisk) {
    confidence = 'NEEDS_REVIEW';
  } else if (confidenceFactors.length >= 3) {
    confidence = 'HIGH';
  } else if (confidenceFactors.length >= 2) {
    confidence = 'MEDIUM';
  } else if (hasStrictRange || issues.length > 1) {
    confidence = 'LOW';
  } else {
    confidence = 'MEDIUM';
  }
  
  return {
    confidence,
    issues,
    wheelCount: techfeedWheels.length,
    confidenceFactors,
    techfeedStats: {
      centerBoreRange: tfCenterBores.size > 0 ? [Math.min(...tfCenterBores), Math.max(...tfCenterBores)] : null,
      offsetRange: tfOffsets.size > 0 ? [Math.min(...tfOffsets), Math.max(...tfOffsets)] : null,
      diameters: [...tfDiameters].sort((a, b) => a - b),
      widths: [...tfWidths].sort((a, b) => a - b),
    },
  };
}

// =============================================================================
// MAIN AUDIT
// =============================================================================

async function runAudit() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('PART 1: WheelPros Techfeed Wheel Spec Validation');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  // Check techfeed availability
  console.log('Checking techfeed bolt pattern coverage...');
  const bpStats = await getTechfeedBoltPatternStats();
  console.log(`Techfeed has ${bpStats.length} bolt patterns with ${bpStats.reduce((a, b) => a + parseInt(b.wheel_count, 10), 0)} total wheels\n`);
  
  console.log('Top 10 bolt patterns:');
  for (const bp of bpStats.slice(0, 10)) {
    console.log(`  ${bp.bolt_pattern}: ${bp.wheel_count} wheels`);
  }
  
  // Load WTD vehicles
  console.log('\nLoading WTD vehicles...');
  const vehicles = await getWTDVehicles();
  console.log(`WTD vehicles with bolt patterns: ${vehicles.length}\n`);
  
  const results = {
    total: 0,
    byConfidence: {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      NEEDS_REVIEW: 0,
    },
    byIssueType: {},
    needsReview: [],
    lowConfidence: [],
    hubRiskVehicles: [],
    offsetIssues: [],
    noBoltPatternMatch: [],
  };
  
  // Cache techfeed data by bolt pattern
  const techfeedCache = {};
  
  console.log('Validating specs...\n');
  
  for (const vehicle of vehicles) {
    const bp = vehicle.bolt_pattern;
    
    // Get techfeed wheels for this bolt pattern
    if (!techfeedCache[bp]) {
      techfeedCache[bp] = await getTechfeedWheelsByBoltPattern(bp);
    }
    
    const techfeedWheels = techfeedCache[bp];
    const validation = validateSpec(vehicle, techfeedWheels);
    
    results.total++;
    results.byConfidence[validation.confidence]++;
    
    // Track issues
    for (const issue of validation.issues) {
      const issueType = issue.split(':')[0];
      results.byIssueType[issueType] = (results.byIssueType[issueType] || 0) + 1;
    }
    
    const vehicleKey = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    const record = {
      vehicle: vehicleKey,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      boltPattern: vehicle.bolt_pattern,
      centerBore: vehicle.center_bore_mm,
      offsetRange: `${vehicle.offset_min_mm}-${vehicle.offset_max_mm}`,
      diameters: extractWheelDiameters(vehicle.oem_wheel_sizes),
      confidence: validation.confidence,
      issues: validation.issues,
      techfeedWheelCount: validation.wheelCount,
      techfeedStats: validation.techfeedStats,
    };
    
    if (validation.confidence === 'NEEDS_REVIEW') {
      results.needsReview.push(record);
    } else if (validation.confidence === 'LOW') {
      results.lowConfidence.push(record);
    }
    
    if (validation.issues.some(i => i.includes('HUB_RISK'))) {
      results.hubRiskVehicles.push(record);
    }
    if (validation.issues.some(i => i.includes('OFFSET'))) {
      results.offsetIssues.push(record);
    }
    if (validation.wheelCount === 0) {
      results.noBoltPatternMatch.push(record);
    }
    
    if (results.total % 500 === 0) {
      console.log(`Processed ${results.total}/${vehicles.length}...`);
    }
  }
  
  // Output summary
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('VALIDATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  console.log(`Total vehicles validated: ${results.total}`);
  console.log(`No techfeed match: ${results.noBoltPatternMatch.length}\n`);
  
  console.log('Confidence Distribution:');
  for (const [level, count] of Object.entries(results.byConfidence)) {
    const pct = ((count / results.total) * 100).toFixed(1);
    console.log(`  ${level}: ${count} (${pct}%)`);
  }
  
  console.log('\nIssue Types:');
  for (const [type, count] of Object.entries(results.byIssueType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  
  console.log(`\n🚨 Hub Risk Vehicles: ${results.hubRiskVehicles.length}`);
  console.log(`⚠️  Offset Issues: ${results.offsetIssues.length}`);
  console.log(`❓ Needs Review: ${results.needsReview.length}`);
  console.log(`📉 Low Confidence: ${results.lowConfidence.length}`);
  
  // Top review candidates
  if (results.needsReview.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('TOP 30 NEEDS REVIEW VEHICLES (Hub Risk)');
    console.log('───────────────────────────────────────────────────────────────────────\n');
    
    for (const v of results.needsReview.slice(0, 30)) {
      console.log(`${v.vehicle} [${v.boltPattern}]`);
      console.log(`  WTD: CB ${v.centerBore}mm | Offset ${v.offsetRange} | Diams ${v.diameters.join(', ')}`);
      if (v.techfeedStats) {
        console.log(`  TF:  CB ${v.techfeedStats.centerBoreRange?.join('-')} | Offset ${v.techfeedStats.offsetRange?.join('-')} | Diams ${v.techfeedStats.diameters?.join(', ')}`);
      }
      console.log(`  Issues: ${v.issues.join('; ')}\n`);
    }
  }
  
  // Offset issues
  if (results.offsetIssues.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('TOP 30 OFFSET RANGE ISSUES');
    console.log('───────────────────────────────────────────────────────────────────────\n');
    
    for (const v of results.offsetIssues.slice(0, 30)) {
      console.log(`${v.vehicle} [${v.boltPattern}]`);
      console.log(`  WTD offset: ${v.offsetRange}`);
      if (v.techfeedStats?.offsetRange) {
        console.log(`  TF offset: ${v.techfeedStats.offsetRange.join(' to ')}`);
      }
      console.log('');
    }
  }
  
  // Save full results
  const outputPath = path.join(__dirname, 'wheelpros-techfeed-validation-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.total,
      byConfidence: results.byConfidence,
      byIssueType: results.byIssueType,
      hubRiskCount: results.hubRiskVehicles.length,
      offsetIssueCount: results.offsetIssues.length,
      noBoltPatternMatchCount: results.noBoltPatternMatch.length,
    },
    needsReview: results.needsReview,
    hubRiskVehicles: results.hubRiskVehicles,
    offsetIssues: results.offsetIssues.slice(0, 100),
    lowConfidence: results.lowConfidence.slice(0, 100),
    noBoltPatternMatch: results.noBoltPatternMatch.slice(0, 100),
  }, null, 2));
  
  console.log(`\n📄 Full results saved: ${outputPath}`);
  
  await pool.end();
  return results;
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
