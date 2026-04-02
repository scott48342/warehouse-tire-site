/**
 * Validate Gap Fixes
 * 
 * Tests that the specific vehicles mentioned in the requirements now work.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";
import { listFitments } from "../src/lib/fitment-db/getFitment";
import { getTrimsWithCoverage, hasYearCoverage } from "../src/lib/fitment-db/coverage";

interface TestCase {
  year: number;
  make: string;
  model: string;
  expectedModel?: string;  // What model name data is stored under
  description: string;
}

const TEST_CASES: TestCase[] = [
  // Originally reported as broken
  { year: 2008, make: "chrysler", model: "300", description: "Chrysler 300 - URL uses '300'" },
  { year: 2015, make: "ford", model: "f-350", expectedModel: "f-350-super-duty", description: "Ford F-350 - URL uses 'f-350'" },
  
  // Additional tests
  { year: 2015, make: "ford", model: "f-250", expectedModel: "f-250-super-duty", description: "Ford F-250 - URL uses 'f-250'" },
  { year: 2020, make: "ford", model: "f-350-super-duty", description: "Ford F-350 - URL uses full name" },
  { year: 2012, make: "chrysler", model: "300", description: "Chrysler 300 2nd Gen" },
  { year: 2022, make: "chrysler", model: "300", description: "Chrysler 300 recent year" },
  { year: 2008, make: "chrysler", model: "300c", description: "Chrysler 300C variant" },
  { year: 2015, make: "chrysler", model: "300c", description: "Chrysler 300C 2nd gen" },
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VALIDATION: GAP FIXES");
  console.log("═══════════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const test of TEST_CASES) {
    console.log(`Testing: ${test.year} ${test.make} ${test.model}`);
    console.log(`  Description: ${test.description}`);
    
    // Test 1: Coverage check works
    const hasCoverage = await hasYearCoverage(test.year, test.make, test.model);
    console.log(`  hasYearCoverage: ${hasCoverage ? "✅ PASS" : "❌ FAIL"}`);
    
    // Test 2: Trims are returned
    const trims = await getTrimsWithCoverage(test.year, test.make, test.model);
    console.log(`  getTrimsWithCoverage: ${trims.hasCoverage ? `✅ PASS (${trims.trims.length} trims)` : "❌ FAIL"}`);
    
    // Test 3: Fitments can be listed
    const fitments = await listFitments(test.year, test.make, test.model);
    const hasData = fitments.fitments.length > 0;
    console.log(`  listFitments: ${hasData ? `✅ PASS (${fitments.fitments.length} records)` : "❌ FAIL"}`);
    
    // Test 4: Fitment data is complete
    if (hasData) {
      const f = fitments.fitments[0];
      const isComplete = f.boltPattern && f.centerBoreMm && f.threadSize;
      console.log(`  Data complete: ${isComplete ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`    Bolt: ${f.boltPattern}, CB: ${f.centerBoreMm}mm, Thread: ${f.threadSize}`);
      
      if (hasCoverage && trims.hasCoverage && hasData && isComplete) {
        passed++;
        console.log(`  RESULT: ✅ PASS\n`);
      } else {
        failed++;
        console.log(`  RESULT: ❌ FAIL\n`);
      }
    } else {
      failed++;
      console.log(`  RESULT: ❌ FAIL - No data returned\n`);
    }
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log();
  
  if (failed === 0) {
    console.log("✅ ALL TESTS PASS - Gap fixes verified");
  } else {
    console.log("❌ SOME TESTS FAILED - Review required");
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
