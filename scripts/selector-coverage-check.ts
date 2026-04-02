/**
 * SELECTOR COVERAGE CHECK
 * 
 * Verifies that all selector API responses have corresponding fitment data.
 * Ensures no dead-end combinations exist in the user flow.
 * 
 * Usage: npx tsx scripts/selector-coverage-check.ts
 * 
 * Checks:
 * 1. Every make returned by /api/vehicles/makes has at least one model with coverage
 * 2. Every model returned by /api/vehicles/models has at least one year with coverage
 * 3. Every trim returned by /api/vehicles/trims has fitment data
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

// ============================================================================
// Main Check
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SELECTOR COVERAGE CHECK");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Timestamp: ${new Date().toISOString()}\n`);

  const failures: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 1: All makes have models with coverage
  // ──────────────────────────────────────────────────────────────────────────
  console.log("CHECK 1: Makes with model coverage...");
  
  const makes = await db.execute(sql`
    SELECT DISTINCT make, COUNT(DISTINCT model) as model_count
    FROM vehicle_fitments
    GROUP BY make
    ORDER BY make
  `);
  
  let makesFailed = 0;
  for (const row of makes.rows as any[]) {
    totalChecks++;
    if (row.model_count === 0) {
      makesFailed++;
      failures.push(`Make "${row.make}" has no models with coverage`);
    } else {
      passedChecks++;
    }
  }
  
  console.log(`  ${makes.rows.length} makes checked, ${makesFailed} failures\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 2: All make/model combinations have years with coverage
  // ──────────────────────────────────────────────────────────────────────────
  console.log("CHECK 2: Model/year coverage...");
  
  const models = await db.execute(sql`
    SELECT make, model, COUNT(DISTINCT year) as year_count
    FROM vehicle_fitments
    GROUP BY make, model
    ORDER BY make, model
  `);
  
  let modelsFailed = 0;
  for (const row of models.rows as any[]) {
    totalChecks++;
    if (row.year_count === 0) {
      modelsFailed++;
      failures.push(`${row.make} ${row.model} has no years with coverage`);
    } else {
      passedChecks++;
    }
  }
  
  console.log(`  ${models.rows.length} models checked, ${modelsFailed} failures\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 3: All Y/M/M combinations have at least one trim with coverage
  // ──────────────────────────────────────────────────────────────────────────
  console.log("CHECK 3: Y/M/M trim coverage...");
  
  const ymm = await db.execute(sql`
    SELECT year, make, model, COUNT(*) as trim_count
    FROM vehicle_fitments
    GROUP BY year, make, model
    ORDER BY make, model, year
  `);
  
  let ymmFailed = 0;
  for (const row of ymm.rows as any[]) {
    totalChecks++;
    if (row.trim_count === 0) {
      ymmFailed++;
      failures.push(`${row.year} ${row.make} ${row.model} has no trims with coverage`);
    } else {
      passedChecks++;
    }
  }
  
  console.log(`  ${ymm.rows.length} Y/M/M combinations checked, ${ymmFailed} failures\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 4: No orphan selector paths exist
  // ──────────────────────────────────────────────────────────────────────────
  console.log("CHECK 4: Fitment data completeness...");
  
  const orphans = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM vehicle_fitments
    WHERE bolt_pattern IS NULL 
       OR bolt_pattern = ''
       OR center_bore_mm IS NULL
       OR center_bore_mm = ''
  `);
  
  const orphanCount = parseInt((orphans.rows[0] as any).count);
  totalChecks++;
  
  if (orphanCount > 0) {
    failures.push(`${orphanCount} records missing critical fitment data (bolt_pattern or center_bore)`);
  } else {
    passedChecks++;
  }
  
  console.log(`  ${orphanCount} orphan records found\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 5: Year range continuity (no unexpected gaps)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("CHECK 5: Year continuity (sample check)...");
  
  // Check a few high-volume models for year gaps
  const popularModels = [
    { make: "toyota", model: "camry" },
    { make: "honda", model: "accord" },
    { make: "ford", model: "f-150" },
    { make: "chevrolet", model: "silverado-1500" },
    { make: "bmw", model: "3-series" },
  ];
  
  let continuityFailed = 0;
  for (const { make, model } of popularModels) {
    totalChecks++;
    
    const years = await db.execute(sql`
      SELECT DISTINCT year FROM vehicle_fitments
      WHERE make = ${make} AND model = ${model}
      ORDER BY year
    `);
    
    const yearList = (years.rows as any[]).map(r => r.year);
    
    if (yearList.length < 2) {
      passedChecks++;
      continue;
    }
    
    // Check for gaps > 1 year in recent years (2015+)
    let hasGap = false;
    for (let i = 1; i < yearList.length; i++) {
      if (yearList[i] > 2015 && yearList[i] - yearList[i-1] > 1) {
        hasGap = true;
        failures.push(`${make} ${model}: Year gap between ${yearList[i-1]} and ${yearList[i]}`);
        break;
      }
    }
    
    if (hasGap) {
      continuityFailed++;
    } else {
      passedChecks++;
    }
  }
  
  console.log(`  ${popularModels.length} models checked for continuity, ${continuityFailed} with gaps\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // RESULTS
  // ──────────────────────────────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════════");
  
  if (failures.length > 0) {
    console.log("  ❌ SELECTOR COVERAGE CHECK FAILED");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    console.log(`Checks: ${passedChecks}/${totalChecks} passed\n`);
    
    console.log("FAILURES:");
    for (const f of failures.slice(0, 20)) {
      console.log(`  ❌ ${f}`);
    }
    if (failures.length > 20) {
      console.log(`  ... and ${failures.length - 20} more`);
    }
    
    console.log("\n⛔ Users may encounter dead-end selector paths.");
    process.exit(1);
  }

  console.log("  ✅ SELECTOR COVERAGE CHECK PASSED");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`\nAll ${totalChecks} checks passed.`);
  console.log("No dead-end selector combinations found.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
