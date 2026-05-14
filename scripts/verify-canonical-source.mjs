/**
 * Verify Canonical Source Enforcement
 * 
 * Checks that tire-sizes route does NOT import or use:
 * - vehicleFitmentConfigurations
 * - getFitmentConfigurations
 * - oem-tire-sizes.json
 * - source: "config" or "static-fallback"
 */

import { readFileSync } from "fs";

const routePath = "src/app/api/vehicles/tire-sizes/route.ts";
const source = readFileSync(routePath, "utf-8");

console.log("═".repeat(70));
console.log(" CANONICAL SOURCE VERIFICATION");
console.log("═".repeat(70));
console.log();

let passed = 0;
let failed = 0;

// Test 1: No active import of static JSON
const hasActiveStaticImport = /^import\s+.*oem-tire-sizes\.json/m.test(source);
if (hasActiveStaticImport) {
  console.log("❌ FAIL: Active import of oem-tire-sizes.json found");
  failed++;
} else {
  console.log("✅ PASS: No active import of oem-tire-sizes.json");
  passed++;
}

// Test 2: No import of getFitmentConfigurations
const hasGetFitmentConfigs = /await import\(['"@].*getFitmentConfigurations/.test(source);
if (hasGetFitmentConfigs) {
  console.log("❌ FAIL: Dynamic import of getFitmentConfigurations found");
  failed++;
} else {
  console.log("✅ PASS: No dynamic import of getFitmentConfigurations");
  passed++;
}

// Test 3: No return of source: "config"
const hasConfigReturn = /return NextResponse\.json\(\{[\s\S]*?source:\s*["']config["'][\s\S]*?\}\)/m.test(source);
if (hasConfigReturn) {
  console.log("❌ FAIL: Found return with source: 'config'");
  failed++;
} else {
  console.log("✅ PASS: No return with source: 'config'");
  passed++;
}

// Test 4: No return of source: "static-fallback"
const hasStaticReturn = /return NextResponse\.json\(\{[\s\S]*?source:\s*["']static-fallback["'][\s\S]*?\}\)/m.test(source);
if (hasStaticReturn) {
  console.log("❌ FAIL: Found return with source: 'static-fallback'");
  failed++;
} else {
  console.log("✅ PASS: No return with source: 'static-fallback'");
  passed++;
}

// Test 5: No call to getStaticOemSizes
const hasStaticCall = /getStaticOemSizes\s*\(/.test(source);
if (hasStaticCall) {
  console.log("❌ FAIL: Found call to getStaticOemSizes()");
  failed++;
} else {
  console.log("✅ PASS: No call to getStaticOemSizes()");
  passed++;
}

// Test 6: Uses canonical resolver
const usesResolver = source.includes("resolveVehicleFitment");
if (!usesResolver) {
  console.log("❌ FAIL: canonicalResolver not used");
  failed++;
} else {
  console.log("✅ PASS: Uses canonicalResolver (resolveVehicleFitment)");
  passed++;
}

// Test 7: STEP 0 is disabled (comment check)
const step0Disabled = source.includes("STEP 0: DISABLED");
if (!step0Disabled) {
  console.log("❌ FAIL: STEP 0 not marked as DISABLED");
  failed++;
} else {
  console.log("✅ PASS: STEP 0 marked as DISABLED");
  passed++;
}

// Test 8: STEP 3 is disabled (comment check)
const step3Disabled = source.includes("STEP 3: DISABLED");
if (!step3Disabled) {
  console.log("❌ FAIL: STEP 3 not marked as DISABLED");
  failed++;
} else {
  console.log("✅ PASS: STEP 3 marked as DISABLED");
  passed++;
}

console.log();
console.log("═".repeat(70));
console.log(` RESULTS: ${passed}/${passed + failed} passed`);
console.log("═".repeat(70));

if (failed > 0) {
  console.log();
  console.log("⚠️  CANONICAL ENFORCEMENT NOT COMPLETE");
  process.exit(1);
} else {
  console.log();
  console.log("✅ CANONICAL ENFORCEMENT VERIFIED");
  console.log("   tire-sizes route uses vehicle_fitments ONLY");
}
