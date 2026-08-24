/**
 * Comprehensive test for isCommercialTruckSize classifier
 */

import { isCommercialTruckSize, STANDARD_TIRE_ADDER, COMMERCIAL_TIRE_ADDER, calculateTireSellPrice } from "../src/lib/tires/tirePricingService";

interface TestCase {
  size: string;
  expected: boolean;
  category: string;
}

const testCases: TestCase[] = [
  // Standard Metric - MUST be false
  { size: "205/55R16", expected: false, category: "Standard Metric" },
  { size: "215/55R16", expected: false, category: "Standard Metric" },
  { size: "225/65R17", expected: false, category: "Standard Metric" },
  { size: "235/55R20", expected: false, category: "Standard Metric" },
  { size: "245/45R20", expected: false, category: "Standard Metric" },
  { size: "265/70R17", expected: false, category: "Standard Metric" },
  { size: "275/70R18", expected: false, category: "Standard Metric" },
  { size: "285/45R22", expected: false, category: "Standard Metric" },
  { size: "195/65R15", expected: false, category: "Standard Metric" },
  { size: "305/30R20", expected: false, category: "Standard Metric" },
  
  // LT Metric - should be false (standard pricing per WTD policy)
  { size: "LT245/75R16", expected: false, category: "LT Metric" },
  { size: "LT275/70R18", expected: false, category: "LT Metric" },
  { size: "LT285/65R20", expected: false, category: "LT Metric" },
  { size: "LT315/70R17", expected: false, category: "LT Metric" },
  
  // ST Trailer - should be false (standard pricing)
  { size: "ST225/75R15", expected: false, category: "ST Trailer" },
  { size: "ST205/75R15", expected: false, category: "ST Trailer" },
  { size: "ST235/80R16", expected: false, category: "ST Trailer" },
  
  // Medium Truck R-Style - MUST be true
  { size: "11R22.5", expected: true, category: "Medium Truck R-Style" },
  { size: "12R22.5", expected: true, category: "Medium Truck R-Style" },
  { size: "11R24.5", expected: true, category: "Medium Truck R-Style" },
  { size: "12R24.5", expected: true, category: "Medium Truck R-Style" },
  
  // Medium Truck Metric - MUST be true
  { size: "225/70R19.5", expected: true, category: "Medium Truck Metric" },
  { size: "245/70R19.5", expected: true, category: "Medium Truck Metric" },
  { size: "255/70R22.5", expected: true, category: "Medium Truck Metric" },
  { size: "275/70R22.5", expected: true, category: "Medium Truck Metric" },
  
  // Compact Numeric - Commercial
  { size: "11225", expected: true, category: "Compact Commercial" },
  { size: "12225", expected: true, category: "Compact Commercial" },
  { size: "22570195", expected: true, category: "Compact Commercial" },
  { size: "25570225", expected: true, category: "Compact Commercial" },
  
  // Compact Numeric - Standard
  { size: "2155516", expected: false, category: "Compact Standard" },
  { size: "2256517", expected: false, category: "Compact Standard" },
  
  // Flotation - 40"+ commercial
  { size: "40X15.50R22", expected: true, category: "Flotation 40+" },
  { size: "42X15.50R26", expected: true, category: "Flotation 40+" },
  { size: "44X19.50R26", expected: true, category: "Flotation 40+" },
  
  // Flotation - under 40" standard
  { size: "35X12.50R20", expected: false, category: "Flotation <40" },
  { size: "37X12.50R20", expected: false, category: "Flotation <40" },
  { size: "37X13.50R22", expected: false, category: "Flotation <40" },
  { size: "38X15.50R20", expected: false, category: "Flotation <40" },
];

console.log("=".repeat(70));
console.log("COMPREHENSIVE isCommercialTruckSize TEST");
console.log("=".repeat(70));
console.log(`STANDARD_TIRE_ADDER: $${STANDARD_TIRE_ADDER}`);
console.log(`COMMERCIAL_TIRE_ADDER: $${COMMERCIAL_TIRE_ADDER}`);
console.log("");

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const tc of testCases) {
  const actual = isCommercialTruckSize(tc.size);
  const status = actual === tc.expected ? "✅" : "❌";
  
  if (actual === tc.expected) {
    passed++;
  } else {
    failed++;
    failures.push(`${tc.size}: expected ${tc.expected}, got ${actual}`);
  }
  
  console.log(`${status} "${tc.size.padEnd(15)}" => ${String(actual).padEnd(5)} (expected: ${tc.expected}) [${tc.category}]`);
}

console.log("");
console.log("=".repeat(70));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log("=".repeat(70));

if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) {
    console.log(`  ❌ ${f}`);
  }
  process.exit(1);
}

// Test the specific bug regression
console.log("\n" + "-".repeat(70));
console.log("BUG REGRESSION TEST: LXST2031655020 (215/55R16)");
console.log("-".repeat(70));
const cost = 53.35;
const isCommercial = isCommercialTruckSize("215/55R16");
const price = calculateTireSellPrice(cost, "215/55R16");
console.log(`Cost: $${cost}`);
console.log(`isCommercialTruckSize: ${isCommercial}`);
console.log(`Adder used: $${isCommercial ? COMMERCIAL_TIRE_ADDER : STANDARD_TIRE_ADDER}`);
console.log(`calculateTireSellPrice: $${price}`);
console.log(`Expected: $103.35`);
console.log(`Result: ${price === 103.35 ? "✅ PASS" : "❌ FAIL"}`);

if (price !== 103.35) {
  console.log("\n❌ BUG REGRESSION FAILED!");
  process.exit(1);
}

console.log("\n✅ ALL TESTS PASSED");
