#!/usr/bin/env node
/**
 * PART 1: WheelPros 2000-Current Wheel Spec Validation
 * 
 * Validates WTD wheel specs against WheelPros compatibility evidence.
 * vehicle_fitments is canonical WTD source.
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
// CONFIGURATION
// =============================================================================

const START_YEAR = 2000;
const END_YEAR = 2026;
const BATCH_SIZE = 100;
const WHEELPROS_DELAY_MS = 200; // Rate limiting

// WheelPros API config
const WHEELPROS_API_URL = 'https://api.wheelpros.com/products/v1/search/wheel';
const WHEELPROS_AUTH_URL = 'https://api.wheelpros.com/auth/token';

// =============================================================================
// AUTH
// =============================================================================

let wpToken = null;
let wpTokenExpiry = 0;

async function getWheelProsToken() {
  if (wpToken && Date.now() < wpTokenExpiry - 60000) {
    return wpToken;
  }

  const resp = await fetch(WHEELPROS_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: process.env.WHEELPROS_API_KEY,
      apiSecret: process.env.WHEELPROS_API_SECRET,
    }),
  });

  if (!resp.ok) {
    throw new Error(`WheelPros auth failed: ${resp.status}`);
  }

  const data = await resp.json();
  wpToken = data.access_token || data.token;
  wpTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return wpToken;
}

// =============================================================================
// WHEELPROS QUERY
// =============================================================================

async function queryWheelProsByBoltPattern(boltPattern, diameter = null) {
  const token = await getWheelProsToken();
  
  const params = new URLSearchParams({
    boltPattern,
    limit: '50',
  });
  if (diameter) {
    params.append('diameter', diameter.toString());
  }

  const resp = await fetch(`${WHEELPROS_API_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    if (resp.status === 429) {
      // Rate limited - wait and retry
      await new Promise(r => setTimeout(r, 5000));
      return queryWheelProsByBoltPattern(boltPattern, diameter);
    }
    return { error: `WheelPros API error: ${resp.status}`, wheels: [] };
  }

  const data = await resp.json();
  return { wheels: data.wheels || data.products || [], error: null };
}

// =============================================================================
// WTD QUERIES
// =============================================================================

async function getWTDVehicles(yearStart, yearEnd, limit = null, offset = 0) {
  const query = `
    SELECT DISTINCT ON (year, make, model)
      year, make, model, bolt_pattern, center_bore_mm,
      offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
      quality_tier
    FROM vehicle_fitments
    WHERE year >= $1 AND year <= $2
      AND bolt_pattern IS NOT NULL
    ORDER BY year, make, model, quality_tier DESC NULLS LAST
    ${limit ? `LIMIT ${limit} OFFSET ${offset}` : ''}
  `;
  
  const result = await pool.query(query, [yearStart, yearEnd]);
  return result.rows;
}

async function getWTDVehicleCount(yearStart, yearEnd) {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT (year, make, model)) as count
    FROM vehicle_fitments
    WHERE year >= $1 AND year <= $2
      AND bolt_pattern IS NOT NULL
  `, [yearStart, yearEnd]);
  return parseInt(result.rows[0].count, 10);
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

function extractWheelWidths(oemWheelSizes) {
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) return [];
  
  const widths = new Set();
  for (const ws of oemWheelSizes) {
    if (typeof ws === 'object' && ws.width) {
      widths.add(ws.width);
    }
  }
  return [...widths].sort((a, b) => a - b);
}

function parseBoltPattern(bp) {
  if (!bp) return null;
  
  // Formats: "5x114.3", "5x4.5", "6x139.7"
  const match = bp.match(/(\d+)x([\d.]+)/i);
  if (!match) return null;
  
  const lugs = parseInt(match[1], 10);
  let pcd = parseFloat(match[2]);
  
  // Convert inches to mm if needed
  if (pcd < 50) {
    pcd = pcd * 25.4;
  }
  
  return { lugs, pcd: Math.round(pcd * 10) / 10 };
}

// =============================================================================
// VALIDATION LOGIC
// =============================================================================

function validateSpec(wtdVehicle, wpWheels) {
  const issues = [];
  const confidenceFactors = [];
  
  const wtdBP = parseBoltPattern(wtdVehicle.bolt_pattern);
  const wtdCB = wtdVehicle.center_bore_mm;
  const wtdOffsetMin = wtdVehicle.offset_min_mm;
  const wtdOffsetMax = wtdVehicle.offset_max_mm;
  const wtdDiameters = extractWheelDiameters(wtdVehicle.oem_wheel_sizes);
  const wtdWidths = extractWheelWidths(wtdVehicle.oem_wheel_sizes);
  
  if (wpWheels.length === 0) {
    return {
      confidence: 'LOW',
      issues: ['No WheelPros wheels found for bolt pattern'],
      wpWheelCount: 0,
      matchingWheels: 0,
    };
  }
  
  // Analyze WheelPros wheels
  const wpCenterBores = new Set();
  const wpOffsets = new Set();
  const wpDiameters = new Set();
  const wpWidths = new Set();
  
  for (const wheel of wpWheels) {
    if (wheel.centerBore) wpCenterBores.add(parseFloat(wheel.centerBore));
    if (wheel.offset) wpOffsets.add(parseFloat(wheel.offset));
    if (wheel.diameter) wpDiameters.add(parseInt(wheel.diameter, 10));
    if (wheel.width) wpWidths.add(parseFloat(wheel.width));
  }
  
  // Check center bore
  if (wtdCB && wpCenterBores.size > 0) {
    const maxWpCB = Math.max(...wpCenterBores);
    if (wtdCB > maxWpCB + 1) {
      issues.push(`HUB_RISK: WTD CB ${wtdCB}mm > max WheelPros CB ${maxWpCB}mm`);
    } else {
      confidenceFactors.push('center_bore_valid');
    }
  }
  
  // Check offset range
  if (wtdOffsetMin !== null && wtdOffsetMax !== null && wpOffsets.size > 0) {
    const minWpOffset = Math.min(...wpOffsets);
    const maxWpOffset = Math.max(...wpOffsets);
    
    if (wtdOffsetMin > minWpOffset + 5) {
      issues.push(`OFFSET_RANGE_TOO_STRICT: WTD min ${wtdOffsetMin} > WP min ${minWpOffset}`);
    }
    if (wtdOffsetMax < maxWpOffset - 5) {
      issues.push(`OFFSET_RANGE_TOO_STRICT: WTD max ${wtdOffsetMax} < WP max ${maxWpOffset}`);
    }
    
    if (issues.length === 0) {
      confidenceFactors.push('offset_range_valid');
    }
  }
  
  // Check diameters
  if (wtdDiameters.length > 0 && wpDiameters.size > 0) {
    const missingDiams = wtdDiameters.filter(d => !wpDiameters.has(d));
    if (missingDiams.length > 0) {
      issues.push(`WTD diameters ${missingDiams.join(', ')} not found in WheelPros`);
    }
    
    // Check for WheelPros diameters not in WTD (potential additions)
    const extraDiams = [...wpDiameters].filter(d => !wtdDiameters.includes(d) && d >= 15 && d <= 24);
    if (extraDiams.length > 0) {
      issues.push(`WheelPros has diameters ${extraDiams.join(', ')} not in WTD (potential additions)`);
    }
    
    if (missingDiams.length === 0) {
      confidenceFactors.push('diameters_match');
    }
  }
  
  // Check widths
  if (wtdWidths.length > 0 && wpWidths.size > 0) {
    const commonWidths = wtdWidths.filter(w => {
      return [...wpWidths].some(wpw => Math.abs(wpw - w) < 0.5);
    });
    
    if (commonWidths.length < wtdWidths.length / 2) {
      issues.push(`WIDTH_RANGE_MISMATCH: WTD widths ${wtdWidths.join(', ')} vs WP ${[...wpWidths].join(', ')}`);
    } else {
      confidenceFactors.push('widths_valid');
    }
  }
  
  // Calculate confidence
  let confidence;
  const hasHubRisk = issues.some(i => i.includes('HUB_RISK'));
  const hasBadSpec = issues.some(i => i.includes('POSSIBLE_BAD'));
  
  if (hasHubRisk || hasBadSpec) {
    confidence = 'NEEDS_REVIEW';
  } else if (confidenceFactors.length >= 3) {
    confidence = 'HIGH';
  } else if (confidenceFactors.length >= 2) {
    confidence = 'MEDIUM';
  } else if (issues.length > 2) {
    confidence = 'LOW';
  } else {
    confidence = 'MEDIUM';
  }
  
  return {
    confidence,
    issues,
    wpWheelCount: wpWheels.length,
    matchingFactors: confidenceFactors,
  };
}

// =============================================================================
// MAIN AUDIT
// =============================================================================

async function runAudit() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('PART 1: WheelPros 2000-Current Wheel Spec Validation');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  const totalCount = await getWTDVehicleCount(START_YEAR, END_YEAR);
  console.log(`Total WTD vehicles (${START_YEAR}-${END_YEAR}): ${totalCount}\n`);
  
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
    widthIssues: [],
    apiErrors: 0,
  };
  
  // Process in batches
  let processed = 0;
  const sampleSize = Math.min(500, totalCount); // Sample for speed
  
  console.log(`Processing sample of ${sampleSize} vehicles...\n`);
  
  const vehicles = await getWTDVehicles(START_YEAR, END_YEAR, sampleSize);
  
  // Group by bolt pattern to reduce API calls
  const byBoltPattern = {};
  for (const v of vehicles) {
    if (!byBoltPattern[v.bolt_pattern]) {
      byBoltPattern[v.bolt_pattern] = [];
    }
    byBoltPattern[v.bolt_pattern].push(v);
  }
  
  console.log(`Unique bolt patterns: ${Object.keys(byBoltPattern).length}\n`);
  
  // Query WheelPros once per bolt pattern
  const bpCache = {};
  
  for (const [bp, bpVehicles] of Object.entries(byBoltPattern)) {
    process.stdout.write(`Checking ${bp}... `);
    
    try {
      const { wheels, error } = await queryWheelProsByBoltPattern(bp);
      
      if (error) {
        console.log(`API error`);
        results.apiErrors++;
        bpCache[bp] = [];
      } else {
        console.log(`${wheels.length} wheels found`);
        bpCache[bp] = wheels;
      }
      
      await new Promise(r => setTimeout(r, WHEELPROS_DELAY_MS));
    } catch (err) {
      console.log(`Error: ${err.message}`);
      results.apiErrors++;
      bpCache[bp] = [];
    }
  }
  
  console.log('\nValidating vehicle specs...\n');
  
  // Now validate each vehicle
  for (const vehicle of vehicles) {
    const wpWheels = bpCache[vehicle.bolt_pattern] || [];
    const validation = validateSpec(vehicle, wpWheels);
    
    results.total++;
    results.byConfidence[validation.confidence]++;
    
    // Track issues
    for (const issue of validation.issues) {
      const issueType = issue.split(':')[0];
      results.byIssueType[issueType] = (results.byIssueType[issueType] || 0) + 1;
    }
    
    // Categorize for review
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
      wpWheelCount: validation.wpWheelCount,
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
    if (validation.issues.some(i => i.includes('WIDTH'))) {
      results.widthIssues.push(record);
    }
    
    processed++;
    if (processed % 100 === 0) {
      console.log(`Processed ${processed}/${vehicles.length}...`);
    }
  }
  
  // Output summary
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('VALIDATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  console.log(`Total vehicles validated: ${results.total}`);
  console.log(`API errors: ${results.apiErrors}\n`);
  
  console.log('Confidence Distribution:');
  for (const [level, count] of Object.entries(results.byConfidence)) {
    const pct = ((count / results.total) * 100).toFixed(1);
    console.log(`  ${level}: ${count} (${pct}%)`);
  }
  
  console.log('\nIssue Types:');
  for (const [type, count] of Object.entries(results.byIssueType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  
  console.log(`\nHub Risk Vehicles: ${results.hubRiskVehicles.length}`);
  console.log(`Offset Issues: ${results.offsetIssues.length}`);
  console.log(`Width Issues: ${results.widthIssues.length}`);
  console.log(`Needs Review: ${results.needsReview.length}`);
  console.log(`Low Confidence: ${results.lowConfidence.length}`);
  
  // Top review candidates
  if (results.needsReview.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('TOP 20 NEEDS REVIEW VEHICLES');
    console.log('───────────────────────────────────────────────────────────────────────\n');
    
    for (const v of results.needsReview.slice(0, 20)) {
      console.log(`${v.vehicle} [${v.boltPattern}]`);
      console.log(`  CB: ${v.centerBore}mm | Offset: ${v.offsetRange} | Diameters: ${v.diameters.join(', ')}`);
      console.log(`  Issues: ${v.issues.join('; ')}\n`);
    }
  }
  
  // Lowest confidence
  if (results.lowConfidence.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('TOP 20 LOW CONFIDENCE VEHICLES');
    console.log('───────────────────────────────────────────────────────────────────────\n');
    
    for (const v of results.lowConfidence.slice(0, 20)) {
      console.log(`${v.vehicle} [${v.boltPattern}]`);
      console.log(`  CB: ${v.centerBore}mm | Offset: ${v.offsetRange} | Diameters: ${v.diameters.join(', ')}`);
      console.log(`  Issues: ${v.issues.join('; ')}\n`);
    }
  }
  
  // Save full results
  const outputPath = path.join(__dirname, 'wheelpros-validation-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Full results saved: ${outputPath}`);
  
  await pool.end();
  return results;
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
