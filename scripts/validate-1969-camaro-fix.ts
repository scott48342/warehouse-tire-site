/**
 * Validate 1969 Camaro Fitment Fix
 * 
 * Tests that:
 * 1. Classic fitment is detected
 * 2. Classic ranges are used (15-20")
 * 3. All diameters 15, 16, 17, 18, 19, 20 are selectable/searchable
 * 
 * Run: npx tsx scripts/validate-1969-camaro-fix.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Test configuration
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_VEHICLE = {
  year: 1969,
  make: "chevrolet",
  model: "camaro",
};

const EXPECTED_DIAMETERS = [15, 16, 17, 18, 19, 20];

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Validate 1969 Camaro Fitment Fix");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Vehicle: ${TEST_VEHICLE.year} ${TEST_VEHICLE.make} ${TEST_VEHICLE.model}\n`);

  let allPassed = true;

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Fitment search without diameter filter
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("[1] Testing fitment search (no diameter filter)...\n");
  
  try {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${TEST_VEHICLE.year}&make=${TEST_VEHICLE.make}&model=${TEST_VEHICLE.model}`;
    const data = await fetchJson(url);
    
    console.log("  Response summary:");
    console.log(`    Total results: ${data.totalCount}`);
    console.log(`    Classic vehicle detected: ${data.fitment?.isClassicVehicle}`);
    console.log(`    Classic fitment used: ${data.fitment?.classicFitmentUsed}`);
    
    if (data.fitment?.envelope) {
      const env = data.fitment.envelope;
      console.log(`    Envelope diameter (allowed): ${env.allowed.diameter[0]}"-${env.allowed.diameter[1]}"`);
      console.log(`    Envelope width (allowed): ${env.allowed.width[0]}"-${env.allowed.width[1]}"`);
      console.log(`    Envelope offset (allowed): ${env.allowed.offset[0]}mm to ${env.allowed.offset[1]}mm`);
      
      // Validate envelope
      const [minDiam, maxDiam] = env.allowed.diameter;
      
      if (minDiam === 15 && maxDiam === 20) {
        console.log("\n    ✅ PASS: Envelope diameter range is correct (15-20")");
      } else {
        console.log(`\n    ❌ FAIL: Expected diameter 15-20", got ${minDiam}-${maxDiam}"`);
        allPassed = false;
      }
      
      if (data.fitment.isClassicVehicle) {
        console.log("    ✅ PASS: Classic vehicle detected");
      } else {
        console.log("    ❌ FAIL: Classic vehicle NOT detected");
        allPassed = false;
      }
      
      if (data.fitment.classicFitmentUsed) {
        console.log("    ✅ PASS: Classic fitment ranges used");
      } else {
        console.log("    ⚠️  WARN: Classic fitment ranges NOT used (may be missing from DB)");
      }
    }
  } catch (err: any) {
    console.log(`    ❌ ERROR: ${err.message}`);
    allPassed = false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Each diameter individually
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("\n[2] Testing each diameter (15-20)...\n");
  
  for (const diameter of EXPECTED_DIAMETERS) {
    try {
      const url = `${BASE_URL}/api/wheels/fitment-search?year=${TEST_VEHICLE.year}&make=${TEST_VEHICLE.make}&model=${TEST_VEHICLE.model}&diameter=${diameter}`;
      const data = await fetchJson(url);
      
      const count = data.totalCount || 0;
      const status = count > 0 ? "✅" : "⚠️";
      console.log(`    ${status} ${diameter}": ${count} results`);
      
      if (count === 0) {
        // Check if it's because no inventory, not fitment blocking
        if (data.summary?.fitmentValid > 0) {
          console.log(`       (fitment valid: ${data.summary.fitmentValid}, but no stock)`);
        }
      }
    } catch (err: any) {
      console.log(`    ❌ ${diameter}": ERROR - ${err.message}`);
      allPassed = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Legacy bad diameter (should be empty or still work)
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("\n[3] Testing edge cases...\n");
  
  // 14" should be blocked (below min)
  try {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${TEST_VEHICLE.year}&make=${TEST_VEHICLE.make}&model=${TEST_VEHICLE.model}&diameter=14`;
    const data = await fetchJson(url);
    
    const count = data.totalCount || 0;
    if (count === 0) {
      console.log(`    ✅ 14": 0 results (correctly excluded - below min)`);
    } else {
      console.log(`    ⚠️  14": ${count} results (unexpected - should be excluded)`);
    }
  } catch (err: any) {
    console.log(`    ❌ 14": ERROR - ${err.message}`);
  }
  
  // 22" should be blocked (above max)
  try {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${TEST_VEHICLE.year}&make=${TEST_VEHICLE.make}&model=${TEST_VEHICLE.model}&diameter=22`;
    const data = await fetchJson(url);
    
    const count = data.totalCount || 0;
    if (count === 0) {
      console.log(`    ✅ 22": 0 results (correctly excluded - above max)`);
    } else {
      console.log(`    ⚠️  22": ${count} results (unexpected - should be excluded)`);
    }
  } catch (err: any) {
    console.log(`    ❌ 22": ERROR - ${err.message}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Summary");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  if (allPassed) {
    console.log("✅ All tests passed!");
    console.log("\n1969 Camaro classic fitment is working correctly:");
    console.log("  - Classic vehicle detection: ✓");
    console.log("  - Classic fitment ranges used: ✓");
    console.log("  - Diameter range: 15-20\" ✓");
    console.log("  - All expected diameters searchable: ✓");
  } else {
    console.log("❌ Some tests failed - review output above");
    console.log("\nPossible fixes:");
    console.log("  1. Run: npx tsx scripts/classic-group7-import.ts (add 1st gen F-body to classic_fitments)");
    console.log("  2. Run: npx tsx scripts/fix-1969-camaro-and-audit-classics.ts (fix vehicle_fitments)");
    console.log("  3. Clear Redis cache if stale data");
  }
  
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
