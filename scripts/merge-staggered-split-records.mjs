#!/usr/bin/env node
/**
 * Staggered Split Record Merger
 * 
 * Repairs the 2018 tgp_solutions import corruption where staggered vehicles
 * were imported as separate Front/Rear records instead of a single record
 * with proper front/rear tire size objects.
 * 
 * Pattern: "SS Front SS" + "SS Rear SS" → "SS" with oem_tire_sizes: {front: [...], rear: [...]}
 * 
 * Usage:
 *   node merge-staggered-split-records.mjs              # Dry-run (default)
 *   node merge-staggered-split-records.mjs --apply      # Apply changes
 *   node merge-staggered-split-records.mjs --year=2018  # Only process specific year
 * 
 * Safety:
 *   - Default is dry-run (no writes)
 *   - Snapshots all affected records before any writes
 *   - Validates exact pair matches before merging
 *   - Does NOT delete original records on first apply
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Parse arguments
const args = process.argv.slice(2);
const APPLY_MODE = args.includes("--apply");
const YEAR_FILTER = args.find(a => a.startsWith("--year="))?.split("=")[1];
const VERBOSE = args.includes("--verbose") || args.includes("-v");

// Config
const SNAPSHOT_DIR = "./scripts/staggered-merge-snapshots";
const RESULTS_DIR = "./scripts/staggered-merge-results";

// Load database connection
const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

if (!dbUrl) {
  console.error("❌ Could not find POSTGRES_URL in .env.local");
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// ===== UTILITY FUNCTIONS =====

/**
 * Extract canonical trim name from corrupted trim like "SS Front SS" → "SS"
 */
function extractCanonicalTrim(displayTrim) {
  // Pattern: "TrimName Front TrimName" or "TrimName Rear TrimName"
  const frontMatch = displayTrim.match(/^(.+?) Front \1$/);
  if (frontMatch) return { canonical: frontMatch[1], axle: "front" };
  
  const rearMatch = displayTrim.match(/^(.+?) Rear \1$/);
  if (rearMatch) return { canonical: rearMatch[1], axle: "rear" };
  
  return null;
}

/**
 * Generate a grouping key for finding matching front/rear pairs
 */
function groupKey(record, canonical) {
  return `${record.year}|${record.make}|${record.model}|${canonical}`;
}

/**
 * Check if two records have compatible specs for merging
 */
function areSpecsCompatible(front, rear) {
  const issues = [];
  
  // Bolt pattern must match exactly
  if (front.bolt_pattern !== rear.bolt_pattern) {
    issues.push(`bolt_pattern: ${front.bolt_pattern} vs ${rear.bolt_pattern}`);
  }
  
  // Center bore must match (allow small tolerance for floating point)
  if (front.center_bore_mm && rear.center_bore_mm) {
    const diff = Math.abs(Number(front.center_bore_mm) - Number(rear.center_bore_mm));
    if (diff > 0.5) {
      issues.push(`center_bore_mm: ${front.center_bore_mm} vs ${rear.center_bore_mm}`);
    }
  }
  
  // Thread size must match
  if (front.thread_size !== rear.thread_size) {
    issues.push(`thread_size: ${front.thread_size} vs ${rear.thread_size}`);
  }
  
  return { compatible: issues.length === 0, issues };
}

/**
 * Validate that front record has front sizes only and rear has rear only
 */
function validateAxleSizes(record, expectedAxle) {
  const tireSizes = record.oem_tire_sizes;
  if (!tireSizes || typeof tireSizes !== "object") return false;
  
  if (expectedAxle === "front") {
    const hasFront = Array.isArray(tireSizes.front) && tireSizes.front.length > 0;
    const hasRear = Array.isArray(tireSizes.rear) && tireSizes.rear.length > 0;
    return hasFront && !hasRear;
  } else {
    const hasFront = Array.isArray(tireSizes.front) && tireSizes.front.length > 0;
    const hasRear = Array.isArray(tireSizes.rear) && tireSizes.rear.length > 0;
    return hasRear && !hasFront;
  }
}

/**
 * Parse wheel size string like "8.5x19" to {width, diameter}
 */
function parseWheelSize(str) {
  if (!str) return null;
  // Handle formats: "8.5x19", "8-8.5x19"
  const match = str.match(/^([\d.-]+)x(\d+)$/);
  if (match) {
    return { width: match[1], diameter: parseInt(match[2]) };
  }
  return null;
}

/**
 * Merge front and rear tire sizes into proper staggered format
 */
function mergeTireSizes(frontSizes, rearSizes) {
  return {
    front: frontSizes?.front || [],
    rear: rearSizes?.rear || []
  };
}

/**
 * Merge front and rear wheel sizes into proper staggered format
 */
function mergeWheelSizes(frontWheels, rearWheels) {
  // Front and rear wheel sizes may be arrays of strings like ["8.5x19"]
  // Convert to structured format with front/rear
  const result = [];
  
  // Parse front wheels
  const frontParsed = (frontWheels || []).map(parseWheelSize).filter(Boolean);
  const rearParsed = (rearWheels || []).map(parseWheelSize).filter(Boolean);
  
  // Try to pair by diameter
  const usedRear = new Set();
  for (const fw of frontParsed) {
    const matchingRear = rearParsed.findIndex((rw, i) => !usedRear.has(i) && rw.diameter === fw.diameter);
    if (matchingRear >= 0) {
      usedRear.add(matchingRear);
      result.push({
        diameter: fw.diameter,
        front_width: parseFloat(fw.width) || fw.width,
        rear_width: parseFloat(rearParsed[matchingRear].width) || rearParsed[matchingRear].width
      });
    } else {
      // No matching rear, just add front
      result.push({
        diameter: fw.diameter,
        front_width: parseFloat(fw.width) || fw.width
      });
    }
  }
  
  // Add any unmatched rear
  for (let i = 0; i < rearParsed.length; i++) {
    if (!usedRear.has(i)) {
      result.push({
        diameter: rearParsed[i].diameter,
        rear_width: parseFloat(rearParsed[i].width) || rearParsed[i].width
      });
    }
  }
  
  return result;
}

/**
 * Create a slug for modification_id
 */
function slug(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ===== MAIN LOGIC =====

async function main() {
  console.log("=".repeat(70));
  console.log(" STAGGERED SPLIT RECORD MERGER");
  console.log(" Mode:", APPLY_MODE ? "🔴 APPLY (WRITING TO DATABASE)" : "🟢 DRY-RUN (read-only)");
  if (YEAR_FILTER) console.log(" Year filter:", YEAR_FILTER);
  console.log("=".repeat(70));
  console.log();
  
  // Ensure directories exist
  if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  
  // ===== PHASE 1: FETCH ALL CORRUPTED RECORDS =====
  console.log("📥 Phase 1: Fetching corrupted records...\n");
  
  let yearClause = "";
  const params = [];
  if (YEAR_FILTER) {
    yearClause = " AND year = $1";
    params.push(parseInt(YEAR_FILTER));
  }
  
  const query = `
    SELECT 
      id, year, make, model, display_trim, raw_trim, modification_id,
      bolt_pattern, center_bore_mm, thread_size,
      oem_tire_sizes, oem_wheel_sizes, source, created_at, updated_at
    FROM vehicle_fitments 
    WHERE (display_trim LIKE '%Front%' OR display_trim LIKE '%Rear%')
      AND source = 'tgp_solutions'
      ${yearClause}
    ORDER BY year, make, model, display_trim
  `;
  
  const { rows: corruptedRecords } = await pool.query(query, params);
  console.log(`   Found ${corruptedRecords.length} corrupted records\n`);
  
  // ===== PHASE 2: GROUP INTO PAIRS =====
  console.log("🔗 Phase 2: Grouping into front/rear pairs...\n");
  
  const groups = new Map(); // key → { front: record, rear: record, canonical: string }
  const ungrouped = [];
  
  for (const record of corruptedRecords) {
    const parsed = extractCanonicalTrim(record.display_trim);
    if (!parsed) {
      ungrouped.push({ record, reason: "Could not parse trim name" });
      continue;
    }
    
    const key = groupKey(record, parsed.canonical);
    if (!groups.has(key)) {
      groups.set(key, { canonical: parsed.canonical, front: null, rear: null, extras: [] });
    }
    
    const group = groups.get(key);
    if (parsed.axle === "front") {
      if (group.front) {
        group.extras.push(record);
      } else {
        group.front = record;
      }
    } else {
      if (group.rear) {
        group.extras.push(record);
      } else {
        group.rear = record;
      }
    }
  }
  
  // ===== PHASE 3: CLASSIFY GROUPS =====
  console.log("📊 Phase 3: Classifying groups...\n");
  
  const safePairs = [];
  const unsafePairs = [];
  const stats = {
    totalGroups: groups.size,
    safePairs: 0,
    missingFront: 0,
    missingRear: 0,
    multipleRecords: 0,
    specConflicts: 0,
    invalidAxleSizes: 0
  };
  
  for (const [key, group] of groups) {
    const issues = [];
    
    // Check we have exactly one front and one rear
    if (!group.front) {
      issues.push("Missing front record");
      stats.missingFront++;
    }
    if (!group.rear) {
      issues.push("Missing rear record");
      stats.missingRear++;
    }
    if (group.extras.length > 0) {
      issues.push(`Has ${group.extras.length} extra record(s)`);
      stats.multipleRecords++;
    }
    
    // If we have both, check compatibility
    if (group.front && group.rear) {
      const compat = areSpecsCompatible(group.front, group.rear);
      if (!compat.compatible) {
        issues.push(...compat.issues.map(i => `Spec conflict: ${i}`));
        stats.specConflicts++;
      }
      
      // Validate axle sizes
      if (!validateAxleSizes(group.front, "front")) {
        issues.push("Front record has invalid tire sizes");
        stats.invalidAxleSizes++;
      }
      if (!validateAxleSizes(group.rear, "rear")) {
        issues.push("Rear record has invalid tire sizes");
        stats.invalidAxleSizes++;
      }
    }
    
    if (issues.length === 0) {
      safePairs.push(group);
      stats.safePairs++;
    } else {
      unsafePairs.push({ group, issues });
    }
  }
  
  // Add ungrouped to unsafe
  for (const ug of ungrouped) {
    unsafePairs.push({ group: { front: ug.record, rear: null, canonical: null }, issues: [ug.reason] });
  }
  
  console.log("   Classification Results:");
  console.log(`   ├─ Total groups:        ${stats.totalGroups}`);
  console.log(`   ├─ Safe pairs:          ${stats.safePairs} ✅`);
  console.log(`   ├─ Missing front:       ${stats.missingFront}`);
  console.log(`   ├─ Missing rear:        ${stats.missingRear}`);
  console.log(`   ├─ Multiple records:    ${stats.multipleRecords}`);
  console.log(`   ├─ Spec conflicts:      ${stats.specConflicts}`);
  console.log(`   └─ Invalid axle sizes:  ${stats.invalidAxleSizes}`);
  console.log();
  
  // ===== PHASE 4: SNAPSHOT =====
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotPath = path.join(SNAPSHOT_DIR, `snapshot-${timestamp}.json`);
  
  console.log("💾 Phase 4: Creating snapshot...\n");
  
  const snapshot = {
    timestamp: new Date().toISOString(),
    mode: APPLY_MODE ? "apply" : "dry-run",
    yearFilter: YEAR_FILTER || null,
    stats,
    safePairs: safePairs.map(g => ({
      canonical: g.canonical,
      front: g.front,
      rear: g.rear
    })),
    unsafePairs: unsafePairs.map(u => ({
      canonical: u.group.canonical,
      issues: u.issues,
      front: u.group.front,
      rear: u.group.rear,
      extras: u.group.extras
    }))
  };
  
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`   Snapshot saved: ${snapshotPath}\n`);
  
  // ===== PHASE 5: SHOW TOP PROPOSED MERGES =====
  console.log("📋 Phase 5: Top 25 Proposed Merges:\n");
  
  const testVehicles = [
    { make: "Chevrolet", model: "Camaro" },
    { make: "Chevrolet", model: "Corvette" },
    { make: "Ford", model: "Mustang" },
    { make: "BMW", model: "M3" },
    { make: "BMW", model: "M4" },
    { make: "Porsche", model: "911" },
    { make: "Mercedes-Benz", model: "AMG GT" },
    { make: "Mercedes-Amg", model: "GT" }
  ];
  
  // Prioritize test vehicles in top 25
  const prioritized = [];
  const remaining = [];
  
  for (const pair of safePairs) {
    const isTestVehicle = testVehicles.some(tv => 
      pair.front.make.toLowerCase() === tv.make.toLowerCase() &&
      pair.front.model.toLowerCase().includes(tv.model.toLowerCase())
    );
    if (isTestVehicle) {
      prioritized.push(pair);
    } else {
      remaining.push(pair);
    }
  }
  
  const top25 = [...prioritized, ...remaining].slice(0, 25);
  
  for (let i = 0; i < top25.length; i++) {
    const pair = top25[i];
    const f = pair.front;
    const r = pair.rear;
    
    const mergedTires = mergeTireSizes(f.oem_tire_sizes, r.oem_tire_sizes);
    const mergedWheels = mergeWheelSizes(f.oem_wheel_sizes, r.oem_wheel_sizes);
    
    console.log(`${String(i + 1).padStart(2)}. ${f.year} ${f.make} ${f.model}`);
    console.log(`    "${f.display_trim}" + "${r.display_trim}"`);
    console.log(`    → "${pair.canonical}"`);
    console.log(`    Tires: F: ${mergedTires.front.join(", ")} | R: ${mergedTires.rear.join(", ")}`);
    console.log(`    Wheels: ${JSON.stringify(mergedWheels)}`);
    console.log();
  }
  
  // ===== PHASE 6: SAMPLE BEFORE/AFTER =====
  console.log("🔄 Phase 6: Sample Before/After:\n");
  
  if (safePairs.length > 0) {
    const sample = safePairs.find(p => 
      p.front.make.toLowerCase() === "chevrolet" && 
      p.front.model.toLowerCase() === "camaro"
    ) || safePairs[0];
    
    const f = sample.front;
    const r = sample.rear;
    
    console.log("   BEFORE (two separate records):");
    console.log(`   ┌─ FRONT: ${f.year} ${f.make} ${f.model} "${f.display_trim}"`);
    console.log(`   │  id: ${f.id}`);
    console.log(`   │  tire_sizes: ${JSON.stringify(f.oem_tire_sizes)}`);
    console.log(`   │  wheel_sizes: ${JSON.stringify(f.oem_wheel_sizes)}`);
    console.log(`   │`);
    console.log(`   └─ REAR: ${r.year} ${r.make} ${r.model} "${r.display_trim}"`);
    console.log(`      id: ${r.id}`);
    console.log(`      tire_sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`      wheel_sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log();
    
    const mergedTires = mergeTireSizes(f.oem_tire_sizes, r.oem_tire_sizes);
    const mergedWheels = mergeWheelSizes(f.oem_wheel_sizes, r.oem_wheel_sizes);
    
    console.log("   AFTER (single merged record):");
    console.log(`   ┌─ ${f.year} ${f.make} ${f.model} "${sample.canonical}"`);
    console.log(`   │  tire_sizes: ${JSON.stringify(mergedTires)}`);
    console.log(`   │  wheel_sizes: ${JSON.stringify(mergedWheels)}`);
    console.log(`   │  bolt: ${f.bolt_pattern}, CB: ${f.center_bore_mm}, thread: ${f.thread_size}`);
    console.log(`   └─ source: "merged-staggered"`);
    console.log();
  }
  
  // ===== PHASE 7: TEST SPECIFIC VEHICLES =====
  console.log("🧪 Phase 7: Validation of Required Test Vehicles:\n");
  
  const testResults = [];
  for (const tv of testVehicles) {
    const matches = safePairs.filter(p => 
      p.front.make.toLowerCase() === tv.make.toLowerCase() &&
      p.front.model.toLowerCase().includes(tv.model.toLowerCase()) &&
      p.front.year === 2018
    );
    
    const unsafeMatches = unsafePairs.filter(u => 
      u.group.front?.make?.toLowerCase() === tv.make.toLowerCase() &&
      u.group.front?.model?.toLowerCase().includes(tv.model.toLowerCase()) &&
      u.group.front?.year === 2018
    );
    
    if (matches.length > 0 || unsafeMatches.length > 0) {
      console.log(`   ${tv.make} ${tv.model}:`);
      if (matches.length > 0) {
        for (const m of matches) {
          console.log(`     ✅ ${m.canonical} - safe to merge`);
        }
        testResults.push({ vehicle: `${tv.make} ${tv.model}`, status: "safe", count: matches.length });
      }
      if (unsafeMatches.length > 0) {
        for (const u of unsafeMatches) {
          console.log(`     ⚠️  ${u.group.canonical || "unknown"} - ${u.issues.join(", ")}`);
        }
        testResults.push({ vehicle: `${tv.make} ${tv.model}`, status: "unsafe", count: unsafeMatches.length });
      }
    } else {
      console.log(`   ${tv.make} ${tv.model}: No corrupted records found`);
      testResults.push({ vehicle: `${tv.make} ${tv.model}`, status: "not-found", count: 0 });
    }
  }
  console.log();
  
  // ===== PHASE 8: APPLY (if requested) =====
  if (APPLY_MODE && safePairs.length > 0) {
    console.log("🔴 Phase 8: APPLYING CHANGES...\n");
    console.log("   ⚠️  This will create merged records and mark originals deprecated.\n");
    
    let applied = 0;
    let errors = 0;
    const appliedIds = [];
    
    for (const pair of safePairs) {
      const f = pair.front;
      const r = pair.rear;
      
      try {
        const mergedTires = mergeTireSizes(f.oem_tire_sizes, r.oem_tire_sizes);
        const mergedWheels = mergeWheelSizes(f.oem_wheel_sizes, r.oem_wheel_sizes);
        
        const newId = crypto.randomUUID();
        const modId = `${f.year}-${slug(pair.canonical)}`;
        
        // Insert merged record
        await pool.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, modification_id, display_trim, raw_trim,
            bolt_pattern, center_bore_mm, thread_size,
            oem_tire_sizes, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
          )
          ON CONFLICT (year, make, model, modification_id) DO UPDATE SET
            oem_tire_sizes = EXCLUDED.oem_tire_sizes,
            oem_wheel_sizes = EXCLUDED.oem_wheel_sizes,
            display_trim = EXCLUDED.display_trim,
            raw_trim = EXCLUDED.raw_trim,
            source = EXCLUDED.source,
            updated_at = NOW()
          RETURNING id
        `, [
          newId, f.year, f.make, f.model, modId, pair.canonical, pair.canonical,
          f.bolt_pattern, f.center_bore_mm, f.thread_size,
          JSON.stringify(mergedTires), JSON.stringify(mergedWheels),
          "merged-staggered"
        ]);
        
        // Mark originals as deprecated by updating source
        // (We don't delete them - safer to mark and review)
        await pool.query(`
          UPDATE vehicle_fitments 
          SET source = 'deprecated-staggered-split', updated_at = NOW()
          WHERE id = ANY($1)
        `, [[f.id, r.id]]);
        
        applied++;
        appliedIds.push({ merged: newId, deprecated: [f.id, r.id] });
        
        if (VERBOSE || applied <= 5) {
          console.log(`   ✅ ${f.year} ${f.make} ${f.model} "${pair.canonical}"`);
        }
      } catch (err) {
        errors++;
        console.error(`   ❌ Error merging ${f.year} ${f.make} ${f.model}: ${err.message}`);
      }
    }
    
    console.log();
    console.log(`   Applied: ${applied}, Errors: ${errors}`);
    
    // Save apply results
    const applyResultsPath = path.join(RESULTS_DIR, `apply-${timestamp}.json`);
    fs.writeFileSync(applyResultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      applied,
      errors,
      appliedIds
    }, null, 2));
    console.log(`   Results saved: ${applyResultsPath}`);
    
  } else if (APPLY_MODE) {
    console.log("   No safe pairs to apply.\n");
  } else {
    console.log("💡 Phase 8: SKIPPED (dry-run mode)\n");
    console.log("   To apply changes, run with --apply flag");
  }
  
  // ===== SUMMARY =====
  console.log();
  console.log("=".repeat(70));
  console.log(" SUMMARY");
  console.log("=".repeat(70));
  console.log(`   Total corrupted records:   ${corruptedRecords.length}`);
  console.log(`   Total groups found:        ${stats.totalGroups}`);
  console.log(`   Safe pairs (ready):        ${stats.safePairs}`);
  console.log(`   Unsafe/ambiguous:          ${unsafePairs.length}`);
  console.log(`   Vehicles affected:         ${stats.safePairs} (${stats.safePairs * 2} records → ${stats.safePairs})`);
  console.log(`   Snapshot path:             ${snapshotPath}`);
  console.log();
  
  if (!APPLY_MODE) {
    console.log("   🟢 DRY-RUN COMPLETE - No changes made");
    console.log("   Run with --apply to write changes");
  } else {
    console.log("   🔴 CHANGES APPLIED");
    console.log("   Original records marked as 'deprecated-staggered-split'");
    console.log("   Review and delete deprecated records after verification");
  }
  console.log();
}

main()
  .catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
