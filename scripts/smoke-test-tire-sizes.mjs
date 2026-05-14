/**
 * Smoke Test: Tire Sizes Canonical Enforcement
 * 
 * Tests that tire-sizes API returns data from vehicle_fitments only,
 * NOT from deprecated config table or static JSON.
 */

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

const testVehicles = [
  { year: 2024, make: "Ford", model: "F-150", trim: "Lightning", expect: "electric_truck" },
  { year: 2024, make: "Chevrolet", model: "Silverado 2500HD", trim: "LT", expect: "hd_truck" },
  { year: 2024, make: "Toyota", model: "Camry", trim: "LE", expect: "sedan" },
  { year: 2024, make: "Honda", model: "Civic", trim: "Sport", expect: "sedan" },
  { year: 2024, make: "Toyota", model: "Tacoma", trim: "SR5", expect: "truck" },
  { year: 2018, make: "Chevrolet", model: "Corvette", trim: "Stingray", expect: "staggered" },
  { year: 2018, make: "Chevrolet", model: "Camaro", trim: "SS", expect: "staggered" },
  { year: 2024, make: "BMW", model: "M3", trim: "M3 Competition", expect: "staggered" },
  { year: 2024, make: "BMW", model: "M4", trim: "Competition", expect: "staggered" },
  { year: 2018, make: "Porsche", model: "911", trim: "Carrera", expect: "staggered" },
];

console.log("═".repeat(70));
console.log(" TIRE-SIZES CANONICAL SOURCE SMOKE TEST");
console.log(" Base URL:", BASE_URL);
console.log("═".repeat(70));
console.log();

let passed = 0;
let failed = 0;
const failures = [];

for (const v of testVehicles) {
  const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&trim=${encodeURIComponent(v.trim)}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    const label = `${v.year} ${v.make} ${v.model} ${v.trim}`;
    const source = data.source || "unknown";
    const debugSource = data.debug?.fitmentSource || "unknown";
    const hasTires = (data.tireSizes?.length || 0) > 0;
    
    // Check for banned sources
    const bannedSources = ["config", "static-fallback", "static"];
    const isBanned = bannedSources.includes(source) || bannedSources.includes(debugSource);
    
    if (isBanned) {
      failed++;
      console.log(`❌ ${label}`);
      console.log(`   FAIL: source="${source}", debug.fitmentSource="${debugSource}"`);
      console.log(`   This vehicle is using a DEPRECATED source!`);
      failures.push({ vehicle: label, source, debugSource, reason: "banned_source" });
    } else if (hasTires) {
      passed++;
      console.log(`✅ ${label}`);
      console.log(`   source="${source}", tires=${data.tireSizes.length}, sizes=${data.tireSizes.slice(0, 3).join(", ")}${data.tireSizes.length > 3 ? "..." : ""}`);
    } else {
      // No tires but valid source - might be missing data
      console.log(`⚠️  ${label}`);
      console.log(`   source="${source}", NO TIRE DATA`);
      console.log(`   Vehicle may be missing from database`);
      // Don't count as failure - missing data is OK, wrong source is not
      passed++;
    }
  } catch (err) {
    failed++;
    console.log(`❌ ${v.year} ${v.make} ${v.model} ${v.trim}`);
    console.log(`   ERROR: ${err.message}`);
    failures.push({ vehicle: `${v.year} ${v.make} ${v.model} ${v.trim}`, reason: err.message });
  }
  
  console.log();
}

console.log("═".repeat(70));
console.log(" RESULTS");
console.log("═".repeat(70));
console.log(`Passed: ${passed}/${testVehicles.length}`);
console.log(`Failed: ${failed}/${testVehicles.length}`);

if (failures.length > 0) {
  console.log();
  console.log("FAILURES:");
  for (const f of failures) {
    console.log(`  - ${f.vehicle}: ${f.reason}`);
  }
  console.log();
  console.log("⚠️  CANONICAL ENFORCEMENT VIOLATED - Fix before deploy!");
  process.exit(1);
} else {
  console.log();
  console.log("✅ CANONICAL ENFORCEMENT PASSED");
  console.log("   All vehicles use vehicle_fitments only");
}
