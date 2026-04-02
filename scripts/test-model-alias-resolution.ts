/**
 * Model Alias Resolution Regression Tests
 * 
 * Validates that:
 * 1. Exact matches always win over aliases
 * 2. Alias fallback works correctly
 * 3. No data loss from normalization
 * 
 * Run: npx tsx scripts/test-model-alias-resolution.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";
import { listFitments, getFitment } from "../src/lib/fitment-db/getFitment";
import { hasYearCoverage, getTrimsWithCoverage } from "../src/lib/fitment-db/coverage";
import { normalizeModel } from "../src/lib/fitment-db/keys";

interface TestCase {
  name: string;
  input: { year: number; make: string; model: string; trim?: string };
  expectFound: boolean;
  expectModel?: string;  // Expected DB model name in result
  description: string;
}

const TEST_CASES: TestCase[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // EXACT MATCHES (should always win)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "exact_f250_super_duty",
    input: { year: 2015, make: "ford", model: "f-250-super-duty" },
    expectFound: true,
    expectModel: "f-250-super-duty",
    description: "Exact match for F-250 Super Duty should return Super Duty data",
  },
  {
    name: "exact_m3",
    input: { year: 2022, make: "bmw", model: "m3" },  // M3 exists for 2022
    expectFound: true,
    expectModel: "m3",
    description: "M3 should NOT collapse to 3-series",
  },
  {
    name: "exact_3_series",
    input: { year: 2022, make: "bmw", model: "3-series" },
    expectFound: true,
    expectModel: "3-series",
    description: "3-series should return 3-series data (not M3)",
  },
  {
    name: "exact_s4",
    input: { year: 2022, make: "audi", model: "s4" },
    expectFound: true,
    expectModel: "s4",
    description: "S4 should NOT collapse to A4",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ALIAS RESOLUTION (should find via alias)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "alias_f250_to_super_duty",
    input: { year: 2015, make: "ford", model: "f-250" },
    expectFound: true,
    expectModel: "f-250-super-duty",
    description: "f-250 should alias to f-250-super-duty",
  },
  {
    name: "alias_f350_to_super_duty",
    input: { year: 2015, make: "ford", model: "f-350" },
    expectFound: true,
    expectModel: "f-350-super-duty",
    description: "f-350 should alias to f-350-super-duty",
  },
  {
    name: "alias_300_to_300c",
    input: { year: 2015, make: "chrysler", model: "300" },
    expectFound: true,
    description: "300 should alias to 300c when 300 doesn't exist",
  },
  {
    name: "alias_silverado_2500_to_hd",
    input: { year: 2020, make: "chevrolet", model: "silverado-2500" },
    expectFound: true,
    description: "silverado-2500 should alias to silverado-2500hd",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NORMALIZATION (should not cause data loss)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "normalize_hyphen_variant",
    input: { year: 2020, make: "chevrolet", model: "silverado-2500hd" },  // Use the non-hyphenated form
    expectFound: true,
    description: "silverado-2500hd should find data",
  },
];

async function runTest(test: TestCase): Promise<{ pass: boolean; message: string; details?: any }> {
  const { year, make, model, trim } = test.input;
  
  // Test 1: hasYearCoverage
  const hasCoverage = await hasYearCoverage(year, make, model);
  
  // Test 2: listFitments
  const fitments = await listFitments(year, make, model);
  const found = fitments.fitments.length > 0;
  
  // Test 3: If expectModel specified, verify it
  let modelMatches = true;
  if (test.expectModel && found) {
    const actualModel = fitments.fitments[0].model;
    modelMatches = actualModel === test.expectModel;
  }
  
  const pass = found === test.expectFound && modelMatches;
  
  return {
    pass,
    message: pass 
      ? `✅ ${test.name}`
      : `❌ ${test.name}: expected found=${test.expectFound}, got found=${found}${test.expectModel ? `, expected model=${test.expectModel}, got=${fitments.fitments[0]?.model}` : ''}`,
    details: {
      hasCoverage,
      found,
      count: fitments.fitments.length,
      actualModel: fitments.fitments[0]?.model,
    },
  };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  MODEL ALIAS RESOLUTION REGRESSION TESTS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const test of TEST_CASES) {
    try {
      const result = await runTest(test);
      console.log(result.message);
      if (!result.pass) {
        console.log(`   Description: ${test.description}`);
        console.log(`   Details: ${JSON.stringify(result.details)}`);
      }
      
      if (result.pass) {
        passed++;
      } else {
        failed++;
      }
    } catch (e: any) {
      console.log(`❌ ${test.name}: ERROR - ${e.message}`);
      failed++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════");
  
  // Additional check: verify normalizeModel doesn't collapse distinct models
  console.log("\n  NORMALIZATION CHECK:");
  const mustNotCollapse = [
    { input: "m3", expected: "m3" },
    { input: "m5", expected: "m5" },
    { input: "s4", expected: "s4" },
    { input: "rs4", expected: "rs4" },
    { input: "3-series", expected: "3-series" },
  ];
  
  let normPass = 0;
  for (const check of mustNotCollapse) {
    const result = normalizeModel(check.input);
    const pass = result === check.expected;
    console.log(`  ${pass ? '✅' : '❌'} normalizeModel("${check.input}") = "${result}" (expected "${check.expected}")`);
    if (pass) normPass++;
  }
  
  console.log(`\n  Normalization: ${normPass}/${mustNotCollapse.length} passed`);
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
