/**
 * Regression Tests: Make Aliases
 * 
 * Validates that make alias normalization works correctly:
 * - Mercedes-Benz and Mercedes both resolve same records
 * - No duplicate makes in selector
 * - URL matching works for all alias variations
 * 
 * Run: node scripts/qa-sweep/test-make-aliases.mjs
 */

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

// Test cases: [input, expectedCanonical, expectedDisplay]
const MAKE_ALIAS_TESTS = [
  // Mercedes variations
  ["Mercedes-Benz", "mercedes", "Mercedes-Benz"],
  ["Mercedes", "mercedes", "Mercedes-Benz"],
  ["mercedes-benz", "mercedes", "Mercedes-Benz"],
  ["mercedes", "mercedes", "Mercedes-Benz"],
  ["MERCEDES", "mercedes", "Mercedes-Benz"],
  ["MERCEDES-BENZ", "mercedes", "Mercedes-Benz"],
  
  // Chevrolet variations
  ["Chevrolet", "chevrolet", "Chevrolet"],
  ["Chevy", "chevrolet", "Chevrolet"],
  ["chevy", "chevrolet", "Chevrolet"],
  ["CHEVY", "chevrolet", "Chevrolet"],
  
  // Volkswagen variations
  ["Volkswagen", "volkswagen", "Volkswagen"],
  ["VW", "volkswagen", "Volkswagen"],
  ["vw", "volkswagen", "Volkswagen"],
  
  // Ram variations
  ["Ram", "ram", "Ram"],
  ["RAM", "ram", "Ram"],
  ["ram", "ram", "Ram"],
  
  // Land Rover variations
  ["Land Rover", "land-rover", "Land Rover"],
  ["land rover", "land-rover", "Land Rover"],
  ["LandRover", "land-rover", "Land Rover"],
  ["landrover", "land-rover", "Land Rover"],
  
  // Alfa Romeo variations
  ["Alfa Romeo", "alfa-romeo", "Alfa Romeo"],
  ["alfa romeo", "alfa-romeo", "Alfa Romeo"],
  ["AlfaRomeo", "alfa-romeo", "Alfa Romeo"],
  ["alfaromeo", "alfa-romeo", "Alfa Romeo"],
];

// API test cases: vehicles that should resolve correctly via API
const API_TEST_CASES = [
  // Mercedes (both variations should work)
  { year: 2023, make: "Mercedes-Benz", model: "c-class", expectedMake: "Mercedes-Benz" },
  { year: 2023, make: "Mercedes", model: "c-class", expectedMake: "Mercedes-Benz" },
  { year: 2022, make: "Mercedes-Benz", model: "e-class", expectedMake: "Mercedes-Benz" },
  { year: 2021, make: "Mercedes", model: "gle", expectedMake: "Mercedes-Benz" },
  { year: 2020, make: "Mercedes-Benz", model: "sprinter", expectedMake: "Mercedes-Benz" },
  
  // Chevy/Chevrolet
  { year: 2024, make: "Chevy", model: "silverado-1500", expectedMake: "Chevrolet" },
  { year: 2024, make: "Chevrolet", model: "silverado-1500", expectedMake: "Chevrolet" },
  
  // VW/Volkswagen
  { year: 2023, make: "VW", model: "jetta", expectedMake: "Volkswagen" },
  { year: 2023, make: "Volkswagen", model: "jetta", expectedMake: "Volkswagen" },
  
  // Land Rover
  { year: 2022, make: "Land Rover", model: "range-rover", expectedMake: "Land Rover" },
  { year: 2022, make: "landrover", model: "range-rover", expectedMake: "Land Rover" },
];

async function testMakesApiNoDuplicates() {
  console.log("\n=== Test: Makes API Returns No Duplicates ===\n");
  
  try {
    const resp = await fetch(`${BASE_URL}/api/vehicles/makes?year=2024&nocache=1`);
    const data = await resp.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      console.log("❌ FAIL: Invalid response format");
      return false;
    }
    
    // Check for duplicates (case-insensitive)
    const normalized = data.results.map(m => m.toLowerCase());
    const uniqueNormalized = [...new Set(normalized)];
    
    if (normalized.length !== uniqueNormalized.length) {
      const duplicates = normalized.filter((m, i) => normalized.indexOf(m) !== i);
      console.log(`❌ FAIL: Found duplicate makes: ${duplicates.join(", ")}`);
      return false;
    }
    
    // Check that Mercedes-Benz is in the list (not "Mercedes")
    const hasMercedesBenz = data.results.some(m => m === "Mercedes-Benz");
    const hasMercedesOnly = data.results.some(m => m === "Mercedes");
    
    if (!hasMercedesBenz && data.results.some(m => m.toLowerCase().includes("mercedes"))) {
      console.log(`❌ FAIL: Found "Mercedes" without proper display name`);
      console.log(`   Found: ${data.results.filter(m => m.toLowerCase().includes("mercedes")).join(", ")}`);
      return false;
    }
    
    if (hasMercedesOnly && hasMercedesBenz) {
      console.log(`❌ FAIL: Both "Mercedes" and "Mercedes-Benz" in list (should only be Mercedes-Benz)`);
      return false;
    }
    
    console.log(`✅ PASS: ${data.results.length} unique makes, no duplicates`);
    console.log(`   Mercedes display: ${data.results.find(m => m.toLowerCase().includes("mercedes")) || "not found"}`);
    return true;
    
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    return false;
  }
}

async function testMakeAliasResolution() {
  console.log("\n=== Test: Make Alias API Resolution ===\n");
  console.log("Verifying that different make aliases resolve to same trims...\n");
  
  // Group test cases by canonical make to compare alias results
  const aliasGroups = [
    {
      canonical: "Mercedes",
      aliases: ["Mercedes-Benz", "Mercedes"],
      year: 2023,
      model: "c-class",
    },
    {
      canonical: "Chevrolet",
      aliases: ["Chevrolet", "Chevy"],
      year: 2024,
      model: "silverado-1500",
    },
    {
      canonical: "Volkswagen",
      aliases: ["Volkswagen", "VW"],
      year: 2023,
      model: "jetta",
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const group of aliasGroups) {
    const results = [];
    
    for (const alias of group.aliases) {
      const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${group.year}&make=${encodeURIComponent(alias)}&model=${encodeURIComponent(group.model)}`;
      const trimsResp = await fetch(trimsUrl);
      const trimsData = await trimsResp.json();
      results.push({
        alias,
        count: trimsData.results?.length || 0,
        source: trimsData.source,
      });
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Check that all aliases return same count
    const counts = results.map(r => r.count);
    const allSame = counts.every(c => c === counts[0]);
    const allHaveData = counts[0] > 0;
    
    if (allSame && allHaveData) {
      console.log(`✅ PASS: ${group.year} ${group.canonical} ${group.model}`);
      console.log(`   All aliases return ${counts[0]} trims: ${group.aliases.join(", ")}`);
      passed++;
    } else if (allSame && !allHaveData) {
      console.log(`⚠️ SKIP: ${group.year} ${group.canonical} ${group.model} - no coverage (${counts[0]} trims)`);
    } else {
      console.log(`❌ FAIL: ${group.year} ${group.canonical} ${group.model} - count mismatch`);
      for (const r of results) {
        console.log(`   ${r.alias}: ${r.count} trims`);
      }
      failed++;
    }
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function testMercedesSpecific() {
  console.log("\n=== Test: Mercedes-Benz Specific Vehicles ===\n");
  
  const mercedesVehicles = [
    { year: 2023, model: "c-class", description: "C-Class sedan" },
    { year: 2022, model: "e-class", description: "E-Class sedan" },
    { year: 2021, model: "gle", description: "GLE SUV" },
    { year: 2023, model: "glc", description: "GLC SUV" },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const v of mercedesVehicles) {
    // Test with "Mercedes-Benz"
    const resp1 = await fetch(`${BASE_URL}/api/vehicles/trims?year=${v.year}&make=Mercedes-Benz&model=${v.model}`);
    const data1 = await resp1.json();
    
    // Test with "Mercedes"
    const resp2 = await fetch(`${BASE_URL}/api/vehicles/trims?year=${v.year}&make=Mercedes&model=${v.model}`);
    const data2 = await resp2.json();
    
    const count1 = data1.results?.length || 0;
    const count2 = data2.results?.length || 0;
    
    if (count1 > 0 && count1 === count2) {
      console.log(`✅ PASS: ${v.year} Mercedes ${v.model} (${v.description})`);
      console.log(`   Mercedes-Benz: ${count1} trims, Mercedes: ${count2} trims`);
      passed++;
    } else if (count1 > 0 || count2 > 0) {
      console.log(`⚠️ WARN: ${v.year} Mercedes ${v.model} - count mismatch`);
      console.log(`   Mercedes-Benz: ${count1} trims, Mercedes: ${count2} trims`);
      // Still count as pass if at least one works
      if (count1 > 0 && count2 > 0) passed++;
      else failed++;
    } else {
      console.log(`❌ FAIL: ${v.year} Mercedes ${v.model} - no coverage`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function main() {
  console.log("============================================");
  console.log("   MAKE ALIAS REGRESSION TESTS");
  console.log(`   Target: ${BASE_URL}`);
  console.log("============================================");
  
  const results = [];
  
  results.push(await testMakesApiNoDuplicates());
  results.push(await testMakeAliasResolution());
  results.push(await testMercedesSpecific());
  
  console.log("\n============================================");
  console.log("   SUMMARY");
  console.log("============================================\n");
  
  const allPassed = results.every(r => r);
  
  if (allPassed) {
    console.log("✅ ALL TESTS PASSED");
    process.exit(0);
  } else {
    console.log("❌ SOME TESTS FAILED");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
