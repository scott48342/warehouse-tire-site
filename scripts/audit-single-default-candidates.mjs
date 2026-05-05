/**
 * Quality Audit: Single-Default Trim Mapping Candidates
 * 
 * NO API CALLS. NO MAPPING CREATION. ANALYSIS ONLY.
 * 
 * Verifies that single-default detection logic is trustworthy before
 * creating 764 pending mappings.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Target makes to sample from
const TARGET_MAKES = [
  'Honda', 'Toyota', 'Audi', 'BMW', 'Nissan', 
  'Chevrolet', 'Ford', 'Jeep', 'RAM', 'Mercedes-Benz'
];

const SAMPLE_SIZE = 40;

/**
 * Extract wheel diameter from wheel size string or object
 */
function extractDiameter(wheelSize) {
  if (!wheelSize) return null;
  
  if (typeof wheelSize === 'object' && wheelSize.diameter) {
    return parseInt(wheelSize.diameter);
  }
  
  if (typeof wheelSize === 'string') {
    let match = wheelSize.match(/x(\d+)/i);
    if (match) return parseInt(match[1]);
    
    match = wheelSize.match(/^(\d+)/);
    if (match && parseInt(match[1]) >= 14 && parseInt(match[1]) <= 26) {
      return parseInt(match[1]);
    }
  }
  
  return null;
}

/**
 * Extract diameter from tire size
 */
function extractTireDiameter(tireSize) {
  if (!tireSize || typeof tireSize !== 'string') return null;
  const match = tireSize.match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Parse OEM sizes
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
 * Deep analyze a vehicle group for audit
 */
function deepAnalyzeVehicle(records) {
  const analysis = {
    recordCount: records.length,
    trims: [],
    allWheelSizes: [],
    allTireSizes: [],
    uniqueDiameters: new Set(),
    diametersByTrim: {},
    tireSizesByDiameter: {},
    potentialIssues: [],
    widthVariations: new Set(),
    offsetVariations: [],
  };
  
  for (const record of records) {
    const trim = record.display_trim || 'Base';
    const wheelSizes = parseOemSizes(record.oem_wheel_sizes);
    const tireSizes = parseOemSizes(record.oem_tire_sizes);
    
    if (!analysis.trims.includes(trim)) {
      analysis.trims.push(trim);
    }
    
    // Track all wheel sizes for this trim
    if (!analysis.diametersByTrim[trim]) {
      analysis.diametersByTrim[trim] = { diameters: new Set(), wheelSizes: [], tireSizes: [] };
    }
    
    for (const ws of wheelSizes) {
      analysis.allWheelSizes.push(ws);
      analysis.diametersByTrim[trim].wheelSizes.push(ws);
      
      const dia = extractDiameter(ws);
      if (dia) {
        analysis.uniqueDiameters.add(dia);
        analysis.diametersByTrim[trim].diameters.add(dia);
      }
      
      // Check for width variations
      if (typeof ws === 'object' && ws.width) {
        analysis.widthVariations.add(ws.width);
      } else if (typeof ws === 'string') {
        const widthMatch = ws.match(/^(\d+\.?\d*)/);
        if (widthMatch) {
          analysis.widthVariations.add(parseFloat(widthMatch[1]));
        }
      }
    }
    
    for (const ts of tireSizes) {
      analysis.allTireSizes.push(ts);
      analysis.diametersByTrim[trim].tireSizes.push(ts);
      
      const dia = extractTireDiameter(ts);
      if (dia) {
        analysis.uniqueDiameters.add(dia);
        if (!analysis.tireSizesByDiameter[dia]) {
          analysis.tireSizesByDiameter[dia] = new Set();
        }
        analysis.tireSizesByDiameter[dia].add(ts);
      }
    }
  }
  
  // Convert sets to arrays for output
  analysis.uniqueDiameters = [...analysis.uniqueDiameters].sort((a, b) => a - b);
  analysis.widthVariations = [...analysis.widthVariations].sort((a, b) => a - b);
  
  for (const trim of Object.keys(analysis.diametersByTrim)) {
    analysis.diametersByTrim[trim].diameters = [...analysis.diametersByTrim[trim].diameters];
  }
  
  for (const dia of Object.keys(analysis.tireSizesByDiameter)) {
    analysis.tireSizesByDiameter[dia] = [...analysis.tireSizesByDiameter[dia]];
  }
  
  // Flag potential issues
  if (analysis.uniqueDiameters.length === 1) {
    // NOTE: Width variations are usually staggered setups (different F/R widths)
    // which is FINE for single-default - same diameter, just different widths.
    // We only flag width variation as informational, not as an issue.
    if (analysis.widthVariations.length > 1) {
      const minWidth = Math.min(...analysis.widthVariations);
      const maxWidth = Math.max(...analysis.widthVariations);
      if (maxWidth - minWidth >= 1.0) {
        analysis.staggeredSetup = true;
        analysis.widthDiff = maxWidth - minWidth;
        // NOT an issue - staggered is fine as long as diameter is the same
      }
    }
    
    // Check for multiple tire sizes at same diameter - informational only
    for (const [dia, sizes] of Object.entries(analysis.tireSizesByDiameter)) {
      if (sizes.length > 3) {
        // More than 3 tire sizes is suspicious but not necessarily an issue
        analysis.potentialIssues.push(`INFO: ${sizes.length} tire sizes for ${dia}" (may include staggered F/R)`);
      }
    }
    
    // REAL ISSUE: Check if different trims have different tire specs
    // This is a problem because we can't auto-select one config for all trims
    const trimTireSets = Object.entries(analysis.diametersByTrim).map(([trim, data]) => ({
      trim,
      // Normalize tire sizes for comparison (strip ZR vs R, etc)
      tires: data.tireSizes
        .filter(t => typeof t === 'string')
        .map(t => t.replace('ZR', 'R').replace('z', '').toLowerCase())
        .sort()
        .join('|'),
    }));
    const uniqueTireSets = new Set(trimTireSets.filter(t => t.tires).map(t => t.tires));
    if (uniqueTireSets.size > 1 && analysis.trims.length > 1) {
      // Different trims have different tire configs - this IS a real issue
      const trimDiffs = trimTireSets.filter(t => t.tires).map(t => `${t.trim}: ${t.tires.split('|')[0]}`);
      analysis.potentialIssues.push(`TRIM_TIRE_VARIANCE: ${trimDiffs.slice(0, 3).join(', ')}`);
    }
  }
  
  return analysis;
}

/**
 * Determine if this is a true single-default
 */
function isTrueSingleDefault(analysis) {
  if (analysis.uniqueDiameters.length !== 1) {
    return { valid: false, reason: 'MULTI_DIAMETER' };
  }
  
  // REAL issues: trim tire variance means different trims need different configs
  const realIssues = analysis.potentialIssues.filter(i => 
    i.includes('TRIM_TIRE_VARIANCE')
  );
  
  if (realIssues.length > 0) {
    return { valid: false, reason: realIssues[0], maybeValid: false };
  }
  
  // Staggered setup is fine - same diameter, just different F/R widths
  if (analysis.staggeredSetup) {
    return { valid: true, reason: `SINGLE_DIAMETER_CONFIRMED (staggered: ${analysis.widthDiff}" width diff)` };
  }
  
  return { valid: true, reason: 'SINGLE_DIAMETER_CONFIRMED' };
}

/**
 * Main audit function
 */
async function runAudit() {
  const client = await pool.connect();
  
  console.log("═".repeat(80));
  console.log("QUALITY AUDIT: SINGLE-DEFAULT TRIM MAPPING CANDIDATES");
  console.log("═".repeat(80));
  console.log("NO API CALLS. NO MAPPING CREATION. ANALYSIS ONLY.");
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log("═".repeat(80));
  console.log("");
  
  try {
    // =========================================================================
    // Step 1: Get all certified fitments
    // =========================================================================
    
    console.log("Step 1: Querying certified vehicle fitments...\n");
    
    const result = await client.query(`
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
    `);
    
    // Group by YMM
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
    
    // =========================================================================
    // Step 2: Find single-default candidates from target makes
    // =========================================================================
    
    console.log("Step 2: Identifying single-default candidates from target makes...\n");
    
    const candidates = [];
    
    for (const [key, group] of Object.entries(ymmGroups)) {
      // Only target makes
      if (!TARGET_MAKES.some(m => group.make.toLowerCase().includes(m.toLowerCase()))) {
        continue;
      }
      
      const analysis = deepAnalyzeVehicle(group.records);
      
      // Only single-diameter vehicles
      if (analysis.uniqueDiameters.length === 1) {
        candidates.push({
          key,
          year: group.year,
          make: group.make,
          model: group.model,
          records: group.records,
          analysis,
        });
      }
    }
    
    console.log(`Found ${candidates.length} single-default candidates from target makes\n`);
    
    // =========================================================================
    // Step 3: Random sample
    // =========================================================================
    
    console.log("Step 3: Randomly sampling 40 vehicles for audit...\n");
    
    // Shuffle and take sample
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, SAMPLE_SIZE);
    
    // Ensure good make distribution
    const makeDistribution = {};
    for (const c of sample) {
      makeDistribution[c.make] = (makeDistribution[c.make] || 0) + 1;
    }
    
    console.log("Sample distribution by make:");
    for (const [make, count] of Object.entries(makeDistribution).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${make}: ${count}`);
    }
    console.log("");
    
    // =========================================================================
    // Step 4: Deep audit each sample
    // =========================================================================
    
    console.log("═".repeat(80));
    console.log("DETAILED AUDIT OF SAMPLED VEHICLES");
    console.log("═".repeat(80));
    console.log("");
    
    const auditResults = {
      confirmed: [],
      flagged: [],
      maybeIssue: [],
    };
    
    for (let i = 0; i < sample.length; i++) {
      const candidate = sample[i];
      const analysis = candidate.analysis;
      const validation = isTrueSingleDefault(analysis);
      
      console.log("─".repeat(80));
      console.log(`[${i + 1}/${SAMPLE_SIZE}] ${candidate.year} ${candidate.make} ${candidate.model}`);
      console.log("─".repeat(80));
      console.log("");
      
      console.log("📋 RECORDS ANALYZED:");
      console.log(`   Record count: ${analysis.recordCount}`);
      console.log(`   Trims found: ${analysis.trims.join(', ')}`);
      console.log("");
      
      console.log("🔧 WHEEL DATA:");
      console.log(`   Unique diameters: ${analysis.uniqueDiameters.join(', ')}"`);
      console.log(`   Width variations: ${analysis.widthVariations.length > 0 ? analysis.widthVariations.join(', ') : 'none detected'}`);
      console.log(`   Raw wheel sizes: ${analysis.allWheelSizes.slice(0, 5).map(w => typeof w === 'object' ? JSON.stringify(w) : w).join(', ')}${analysis.allWheelSizes.length > 5 ? '...' : ''}`);
      console.log("");
      
      console.log("🚗 TIRE DATA:");
      for (const [dia, sizes] of Object.entries(analysis.tireSizesByDiameter)) {
        console.log(`   ${dia}": ${sizes.slice(0, 4).join(', ')}${sizes.length > 4 ? ` (+${sizes.length - 4} more)` : ''}`);
      }
      console.log("");
      
      console.log("📊 DETECTED CONFIG:");
      console.log(`   Single-default: ${analysis.uniqueDiameters.length === 1 ? 'YES' : 'NO'}`);
      console.log(`   Diameter: ${analysis.uniqueDiameters[0]}"`);
      console.log(`   Default tire: ${Object.values(analysis.tireSizesByDiameter)[0]?.[0] || 'unknown'}`);
      console.log(`   Staggered setup: ${analysis.staggeredSetup ? `YES (${analysis.widthDiff}" width diff F/R)` : 'NO (square)'}`);
      console.log("");
      
      console.log("🔍 TRIM-BY-TRIM BREAKDOWN:");
      for (const [trim, data] of Object.entries(analysis.diametersByTrim)) {
        console.log(`   ${trim}:`);
        console.log(`     Diameters: ${data.diameters.join(', ')}"`);
        console.log(`     Tires: ${data.tireSizes.slice(0, 3).join(', ')}${data.tireSizes.length > 3 ? '...' : ''}`);
      }
      console.log("");
      
      console.log("⚠️  POTENTIAL ISSUES:");
      if (analysis.potentialIssues.length === 0) {
        console.log("   None detected");
      } else {
        for (const issue of analysis.potentialIssues) {
          console.log(`   ⚠️  ${issue}`);
        }
      }
      console.log("");
      
      console.log("✅ VALIDATION:");
      if (validation.valid) {
        console.log(`   ✅ CONFIRMED: ${validation.reason}`);
        auditResults.confirmed.push(candidate);
      } else if (validation.maybeValid) {
        console.log(`   🟡 FLAGGED (may still be valid): ${validation.reason}`);
        auditResults.maybeIssue.push({ candidate, reason: validation.reason });
      } else {
        console.log(`   ❌ FLAGGED: ${validation.reason}`);
        auditResults.flagged.push({ candidate, reason: validation.reason });
      }
      console.log("");
    }
    
    // =========================================================================
    // Step 5: Summary
    // =========================================================================
    
    console.log("");
    console.log("═".repeat(80));
    console.log("AUDIT SUMMARY");
    console.log("═".repeat(80));
    console.log("");
    
    console.log("SAMPLE RESULTS:");
    console.log(`  ✅ Confirmed valid: ${auditResults.confirmed.length}/${SAMPLE_SIZE}`);
    console.log(`  🟡 Maybe issues: ${auditResults.maybeIssue.length}/${SAMPLE_SIZE}`);
    console.log(`  ❌ Flagged issues: ${auditResults.flagged.length}/${SAMPLE_SIZE}`);
    console.log("");
    
    const errorRate = (auditResults.flagged.length + auditResults.maybeIssue.length) / SAMPLE_SIZE;
    const confidenceRate = (auditResults.confirmed.length / SAMPLE_SIZE) * 100;
    
    console.log("ESTIMATED CONFIDENCE:");
    console.log(`  Sample confidence: ${confidenceRate.toFixed(1)}%`);
    console.log(`  Potential error rate: ${(errorRate * 100).toFixed(1)}%`);
    console.log("");
    
    // Estimate for full batch
    const totalCandidates = candidates.length;
    const estimatedClean = Math.floor(totalCandidates * (auditResults.confirmed.length / SAMPLE_SIZE));
    const estimatedFlagged = Math.ceil(totalCandidates * errorRate);
    
    console.log("PROJECTED FOR FULL BATCH (764 mappings):");
    console.log(`  Estimated clean mappings: ~${estimatedClean}`);
    console.log(`  Estimated potentially problematic: ~${estimatedFlagged}`);
    console.log("");
    
    // Recommendation
    console.log("─".repeat(40));
    console.log("RECOMMENDATION:");
    console.log("─".repeat(40));
    
    if (confidenceRate >= 95) {
      console.log("  🟢 HIGH CONFIDENCE - Safe to run full batch");
      console.log(`     Recommended batch size: 764 (all)`);
    } else if (confidenceRate >= 85) {
      console.log("  🟡 MEDIUM CONFIDENCE - Run in smaller batches");
      const safeBatch = Math.floor(764 * 0.5);
      console.log(`     Recommended initial batch size: ${safeBatch}`);
      console.log(`     Filter: High-confidence only, exclude flagged makes`);
    } else {
      console.log("  🔴 LOW CONFIDENCE - Review logic before proceeding");
      const safeBatch = Math.floor(764 * 0.25);
      console.log(`     Recommended initial batch size: ${safeBatch}`);
      console.log(`     Action: Fix detection logic first`);
    }
    console.log("");
    
    // List flagged vehicles
    if (auditResults.flagged.length > 0 || auditResults.maybeIssue.length > 0) {
      console.log("─".repeat(40));
      console.log("FLAGGED VEHICLES (review manually):");
      console.log("─".repeat(40));
      
      for (const { candidate, reason } of [...auditResults.flagged, ...auditResults.maybeIssue]) {
        console.log(`  ❌ ${candidate.year} ${candidate.make} ${candidate.model}`);
        console.log(`     Reason: ${reason}`);
      }
      console.log("");
    }
    
    console.log("═".repeat(80));
    console.log("AUDIT COMPLETE - NO CHANGES MADE");
    console.log("═".repeat(80));
    
    return {
      sampleSize: SAMPLE_SIZE,
      confirmed: auditResults.confirmed.length,
      flagged: auditResults.flagged.length,
      maybeIssue: auditResults.maybeIssue.length,
      confidenceRate,
      errorRate,
    };
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
runAudit()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch(err => {
    console.error("\n❌ ERROR:", err);
    process.exit(1);
  });
