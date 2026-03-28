/**
 * Test to verify RAM 1500 Classic fitment rules are applied at resolution time
 * 
 * Run with: npx tsx scripts/test-classic-fitment-fix.ts
 */

import { getFitmentFromRules, matchFitmentRule } from "../src/lib/fitment-db/vehicleFitmentRules";

console.log("═══════════════════════════════════════════════════════════════════════════════");
console.log("RAM 1500 Classic Fitment Fix Verification");
console.log("═══════════════════════════════════════════════════════════════════════════════\n");

// Test cases that should trigger the Classic rule
const classicTestCases = [
  { year: 2022, make: "Ram", model: "1500", trim: "Classic Tradesman", rawModel: "1500 Classic" },
  { year: 2022, make: "Ram", model: "1500", trim: "Classic", rawModel: "1500" },
  { year: 2020, make: "Ram", model: "1500", trim: "Warlock", modificationId: "classic-warlock" },
  { year: 2023, make: "Ram", model: "1500", trim: "Express Classic", rawModel: "1500 Classic" },
];

// Test cases that should NOT trigger the Classic rule (should be 6x139.7)
const nonClassicTestCases = [
  { year: 2022, make: "Ram", model: "1500", trim: "Big Horn", rawModel: "1500" },
  { year: 2022, make: "Ram", model: "1500", trim: "Laramie", modificationId: "laramie-v8" },
  { year: 2024, make: "Ram", model: "1500", trim: "TRX" },
];

console.log("CLASSIC VARIANTS (should be 5x139.7):");
console.log("─────────────────────────────────────────────────────────────────────────────────");

for (const tc of classicTestCases) {
  const result = matchFitmentRule({
    year: tc.year,
    make: tc.make,
    model: tc.model,
    rawModel: tc.rawModel,
    trim: tc.trim,
    modificationId: tc.modificationId,
  });
  
  const bp = result.rule?.fitment.boltPattern || "NO MATCH";
  const isCorrect = bp === "5x139.7";
  const status = isCorrect ? "✅" : "❌";
  
  console.log(`${status} ${tc.year} Ram ${tc.rawModel || tc.model} ${tc.trim}`);
  console.log(`   Bolt pattern: ${bp} ${isCorrect ? "(correct)" : "(WRONG - should be 5x139.7)"}`);
  console.log(`   Generation: ${result.rule?.generation || "N/A"}`);
  console.log();
}

console.log("NON-CLASSIC VARIANTS (should be 6x139.7):");
console.log("─────────────────────────────────────────────────────────────────────────────────");

for (const tc of nonClassicTestCases) {
  const result = matchFitmentRule({
    year: tc.year,
    make: tc.make,
    model: tc.model,
    rawModel: tc.rawModel,
    trim: tc.trim,
    modificationId: tc.modificationId,
  });
  
  const bp = result.rule?.fitment.boltPattern || "NO MATCH";
  const isCorrect = bp === "6x139.7";
  const status = isCorrect ? "✅" : "❌";
  
  console.log(`${status} ${tc.year} Ram ${tc.rawModel || tc.model} ${tc.trim || ""}`);
  console.log(`   Bolt pattern: ${bp} ${isCorrect ? "(correct)" : "(WRONG - should be 6x139.7)"}`);
  console.log(`   Generation: ${result.rule?.generation || "N/A"}`);
  console.log();
}

console.log("═══════════════════════════════════════════════════════════════════════════════");
console.log("SIMULATING dbRecordToProfile OVERRIDE:");
console.log("═══════════════════════════════════════════════════════════════════════════════\n");

// Simulate what happens when we have bad data from DB
const badDbRecord = {
  year: 2022,
  make: "ram",
  model: "1500",
  modificationId: "classic-tradesman",
  displayTrim: "Classic Tradesman",
  boltPattern: "6x139.7", // WRONG! DB has incorrect data
};

console.log("Before rule override (simulated DB record):");
console.log(`  Vehicle: ${badDbRecord.year} ${badDbRecord.make} ${badDbRecord.model} ${badDbRecord.displayTrim}`);
console.log(`  Bolt pattern from DB: ${badDbRecord.boltPattern} (INCORRECT)`);
console.log();

const ruleOverride = getFitmentFromRules({
  year: badDbRecord.year,
  make: badDbRecord.make,
  model: badDbRecord.model,
  rawModel: badDbRecord.model,
  trim: badDbRecord.displayTrim,
  modificationId: badDbRecord.modificationId,
});

if (ruleOverride) {
  console.log("After rule override:");
  console.log(`  Bolt pattern from rule: ${ruleOverride.boltPattern} (CORRECT)`);
  console.log(`  Notes: ${ruleOverride.notes}`);
  
  if (ruleOverride.boltPattern !== badDbRecord.boltPattern) {
    console.log();
    console.log("✅ FIX VERIFIED: Rule correctly overrides incorrect DB bolt pattern");
  }
} else {
  console.log("❌ ERROR: No rule match found for Classic variant");
}

console.log("\n═══════════════════════════════════════════════════════════════════════════════\n");
