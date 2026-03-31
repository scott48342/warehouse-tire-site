/**
 * Test Classic Tire Upsize Engine
 * 
 * Run: npx tsx scripts/test-classic-upsize.ts
 */

import {
  parseTireSize,
  parseMultipleTireSizes,
  calculateOverallDiameter,
  generateClassicUpsizeTable,
  getClassicTireSizesForWheelDiameter,
} from "../src/lib/classic-fitment/classicTireUpsize";

console.log("=".repeat(60));
console.log("CLASSIC TIRE UPSIZE ENGINE TEST");
console.log("=".repeat(60));

// ============================================================================
// Test 1: Legacy Size Parsing
// ============================================================================

console.log("\n📋 TEST 1: Legacy Size Parsing\n");

const legacyTests = [
  "E70-14",   // Alpha-numeric (1969 Camaro stock)
  "F70-14",   // Alpha-numeric
  "G60-15",   // 60-series performance
  "7.00-14",  // Numeric bias-ply
  "8.55-15",  // Numeric
  "225/70R14", // Already metric
  "255/60R15", // Metric
];

for (const size of legacyTests) {
  const parsed = parseTireSize(size);
  if (parsed) {
    const od = calculateOverallDiameter(parsed);
    console.log(`  ${size.padEnd(12)} → ${parsed.metric.padEnd(12)} OD: ${od.toFixed(1)}"`);
  } else {
    console.log(`  ${size.padEnd(12)} → ❌ FAILED TO PARSE`);
  }
}

// ============================================================================
// Test 2: 1969 Camaro Stock (E70-14)
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("📋 TEST 2: 1969 Camaro Upsize Table (E70-14)");
console.log("=".repeat(60));

const camaroStock = "E70-14";
const camaroTable = generateClassicUpsizeTable(camaroStock);

console.log(`\nStock: ${camaroStock}`);
const stockParsed = parseTireSize(camaroStock);
if (stockParsed) {
  console.log(`Metric: ${stockParsed.metric}`);
  console.log(`Overall Diameter: ${calculateOverallDiameter(stockParsed).toFixed(2)}"\n`);
}

for (const result of camaroTable) {
  const rec = result.recommended ? "✅ RECOMMENDED" : "";
  console.log(`\n${result.rimDiameter}" Wheel ${rec}`);
  console.log(`  Variance: ${result.diameterVariance.toFixed(2)}%`);
  console.log(`  Options:`);
  for (const size of result.sizes.slice(0, 3)) {
    const od = calculateOverallDiameter(size);
    console.log(`    - ${size.metric} (OD: ${od.toFixed(1)}")`);
  }
}

// ============================================================================
// Test 3: Specific Wheel Diameter Query
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("📋 TEST 3: Get Tire Sizes for Specific Wheel Diameters");
console.log("=".repeat(60));

const wheelDiameters = [15, 16, 17, 18, 20];

for (const diameter of wheelDiameters) {
  const sizes = getClassicTireSizesForWheelDiameter(camaroStock, diameter);
  console.log(`\n${diameter}" Wheel → ${sizes.length > 0 ? sizes.join(", ") : "❌ No matches"}`);
}

// ============================================================================
// Test 4: Different Classic Platforms
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("📋 TEST 4: Multiple Classic Platforms");
console.log("=".repeat(60));

const platforms = [
  { name: "1969 Camaro", stock: "E70-14" },
  { name: "1970 Chevelle SS", stock: "F70-14" },
  { name: "1969 Mustang Boss", stock: "F60-15" },
  { name: "1970 Cuda", stock: "G60-15" },
  { name: "1968 Charger", stock: "F70-14" },
];

for (const platform of platforms) {
  const parsed = parseTireSize(platform.stock);
  if (!parsed) {
    console.log(`\n${platform.name}: ❌ Could not parse ${platform.stock}`);
    continue;
  }
  
  const od = calculateOverallDiameter(parsed);
  console.log(`\n${platform.name}`);
  console.log(`  Stock: ${platform.stock} → ${parsed.metric} (OD: ${od.toFixed(1)}")`);
  
  // Show 17" upsize recommendation
  const sizes17 = getClassicTireSizesForWheelDiameter(platform.stock, 17);
  console.log(`  17" Upsize: ${sizes17.slice(0, 2).join(", ") || "None"}`);
}

// ============================================================================
// Test 5: Variance Check
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("📋 TEST 5: Variance Validation");
console.log("=".repeat(60));

const stockOD = calculateOverallDiameter(parseTireSize("E70-14")!);
console.log(`\nStock OD: ${stockOD.toFixed(2)}"`);
console.log(`Acceptable Range (±3%): ${(stockOD * 0.97).toFixed(2)}" - ${(stockOD * 1.03).toFixed(2)}"\n`);

for (const result of camaroTable) {
  if (result.sizes.length > 0) {
    const best = result.sizes[0];
    const bestOD = calculateOverallDiameter(best);
    const withinSpec = result.diameterVariance <= 3 ? "✅" : "⚠️";
    console.log(`${result.rimDiameter}": ${best.metric} → OD: ${bestOD.toFixed(2)}" (${result.diameterVariance.toFixed(2)}%) ${withinSpec}`);
  }
}

console.log("\n" + "=".repeat(60));
console.log("✅ TEST COMPLETE");
console.log("=".repeat(60));
