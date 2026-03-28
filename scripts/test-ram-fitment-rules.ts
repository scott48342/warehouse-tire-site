/**
 * Test script to verify RAM 1500 fitment rules
 * Run with: npx tsx scripts/test-ram-fitment-rules.ts
 */

import { matchFitmentRule, getRam1500GenerationInfo, isRam1500Classic } from "../src/lib/fitment-db/vehicleFitmentRules";

console.log("═══════════════════════════════════════════════════════════════");
console.log("RAM 1500 Fitment Rules Test");
console.log("═══════════════════════════════════════════════════════════════\n");

// Test cases
const testCases = [
  {
    desc: "2020 Ram 1500 Big Horn (5th Gen - should be 6x139.7)",
    year: 2020,
    make: "ram",
    model: "1500",
    trim: "Big Horn",
    expected: "6x139.7",
  },
  {
    desc: "2020 Ram 1500 Classic Warlock (Classic - should be 5x139.7)",
    year: 2020,
    make: "ram",
    model: "1500",
    trim: "Classic Warlock",
    expected: "5x139.7",
  },
  {
    desc: "2020 Ram 1500 Classic Tradesman (Classic - should be 5x139.7)",
    year: 2020,
    make: "ram",
    model: "1500",
    rawModel: "1500 Classic",
    trim: "Tradesman",
    expected: "5x139.7",
  },
  {
    desc: "2017 Ram 1500 (4th Gen - should be 5x139.7)",
    year: 2017,
    make: "ram",
    model: "1500",
    trim: "Laramie",
    expected: "5x139.7",
  },
  {
    desc: "2024 Ram 1500 TRX (5th Gen - should be 6x139.7)",
    year: 2024,
    make: "ram",
    model: "1500",
    trim: "TRX",
    expected: "6x139.7",
  },
  {
    desc: "2023 Ram 1500 Classic Express (Classic - should be 5x139.7)",
    year: 2023,
    make: "ram",
    model: "1500",
    modificationId: "classic-express-v8",
    trim: "Express",
    expected: "5x139.7",
  },
  {
    desc: "2010 Ram 1500 (4th Gen early - should be 5x139.7)",
    year: 2010,
    make: "ram",
    model: "1500",
    trim: "SLT",
    expected: "5x139.7",
  },
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = matchFitmentRule({
    year: tc.year,
    make: tc.make,
    model: tc.model,
    rawModel: tc.rawModel,
    trim: tc.trim,
    modificationId: tc.modificationId,
  });

  const actual = result.rule?.fitment.boltPattern || "NO MATCH";
  const status = actual === tc.expected ? "✅ PASS" : "❌ FAIL";
  
  if (actual === tc.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${status}: ${tc.desc}`);
  console.log(`       Expected: ${tc.expected}`);
  console.log(`       Actual:   ${actual}`);
  if (result.rule) {
    console.log(`       Gen:      ${result.rule.generation}`);
  }
  console.log();
}

console.log("═══════════════════════════════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════════════════\n");

// Additional helper function tests
console.log("Helper Function Tests:");
console.log("─────────────────────────────────────────────────────────────────");

const classic2020 = isRam1500Classic(2020, "1500 Classic", "Warlock");
const nonClassic2020 = isRam1500Classic(2020, "1500", "Big Horn");
const pre2019 = isRam1500Classic(2017, "1500", "Laramie");

console.log(`isRam1500Classic(2020, "1500 Classic", "Warlock") = ${classic2020} (expected: true)`);
console.log(`isRam1500Classic(2020, "1500", "Big Horn") = ${nonClassic2020} (expected: false)`);
console.log(`isRam1500Classic(2017, "1500", "Laramie") = ${pre2019} (expected: false)`);
console.log();

const genInfo1 = getRam1500GenerationInfo(2020, "1500", "Big Horn");
const genInfo2 = getRam1500GenerationInfo(2020, "1500 Classic", "Warlock");
const genInfo3 = getRam1500GenerationInfo(2017, "1500", "Laramie");

console.log("Generation Info:");
console.log(`2020 Ram 1500 Big Horn:`, genInfo1);
console.log(`2020 Ram 1500 Classic Warlock:`, genInfo2);
console.log(`2017 Ram 1500 Laramie:`, genInfo3);

process.exit(failed > 0 ? 1 : 0);
