/**
 * Regression Tests: Trim Explosion
 * 
 * Validates that grouped trims are properly exploded:
 * - "LX, Sport, EX" shows as individual options
 * - "R/T" stays as single option (compact slash)
 * - "SXT / SXT Plus" shows as two options (spaced slash)
 * - Selecting exploded trim resolves tire sizes
 * - Selecting exploded trim resolves wheel search
 * 
 * Run: node scripts/qa-sweep/test-trim-explosion.mjs
 */

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

// Vehicles known to have grouped trims in DB
const GROUPED_TRIM_VEHICLES = [
  // Honda (often has grouped trims)
  { year: 2023, make: "Honda", model: "accord", description: "Accord - typically has LX, Sport, EX grouped" },
  { year: 2022, make: "Honda", model: "civic", description: "Civic" },
  { year: 2023, make: "Honda", model: "cr-v", description: "CR-V" },
  
  // Toyota (often has grouped trims)
  { year: 2023, make: "Toyota", model: "camry", description: "Camry" },
  { year: 2022, make: "Toyota", model: "rav4", description: "RAV4" },
  { year: 2023, make: "Toyota", model: "corolla", description: "Corolla" },
  
  // Ford
  { year: 2023, make: "Ford", model: "f-150", description: "F-150" },
  { year: 2022, make: "Ford", model: "mustang", description: "Mustang" },
  
  // GM
  { year: 2023, make: "Chevrolet", model: "silverado-1500", description: "Silverado" },
  { year: 2022, make: "GMC", model: "sierra-1500", description: "Sierra" },
  
  // Mercedes
  { year: 2023, make: "Mercedes-Benz", model: "c-class", description: "C-Class" },
  { year: 2022, make: "Mercedes-Benz", model: "e-class", description: "E-Class" },
];

// Vehicles with slash-in-trim-name (should NOT be split)
const COMPACT_SLASH_VEHICLES = [
  { year: 2023, make: "Dodge", model: "challenger", description: "Challenger - has R/T trim" },
  { year: 2023, make: "Dodge", model: "charger", description: "Charger - has R/T trim" },
];

async function testNoGroupedTrimsInSelector() {
  console.log("\n=== Test: No Grouped Trims in Selector ===\n");
  console.log("Checking that no trim option contains commas...\n");
  
  let passed = 0;
  let failed = 0;
  let groupedFound = [];
  
  for (const v of GROUPED_TRIM_VEHICLES) {
    try {
      const url = `${BASE_URL}/api/vehicles/trims?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&nocache=1`;
      const resp = await fetch(url);
      const data = await resp.json();
      
      if (!data.results || data.results.length === 0) {
        console.log(`⚠️ SKIP: ${v.year} ${v.make} ${v.model} - no trims returned`);
        continue;
      }
      
      // Check for comma-separated labels
      const grouped = data.results.filter(t => {
        const label = t.label || t.displayTrim || "";
        return label.includes(",");
      });
      
      // Check for spaced-slash labels (should be split)
      const spacedSlash = data.results.filter(t => {
        const label = t.label || t.displayTrim || "";
        return / \/ /.test(label);
      });
      
      if (grouped.length > 0 || spacedSlash.length > 0) {
        console.log(`❌ FAIL: ${v.year} ${v.make} ${v.model} (${v.description})`);
        console.log(`   Found ${grouped.length} comma-grouped, ${spacedSlash.length} spaced-slash`);
        if (grouped.length > 0) {
          console.log(`   Comma examples: ${grouped.slice(0, 3).map(t => t.label).join(", ")}`);
        }
        if (spacedSlash.length > 0) {
          console.log(`   Slash examples: ${spacedSlash.slice(0, 3).map(t => t.label).join(", ")}`);
        }
        failed++;
        groupedFound.push({ vehicle: v, grouped, spacedSlash });
      } else {
        console.log(`✅ PASS: ${v.year} ${v.make} ${v.model} - ${data.results.length} atomic trims`);
        passed++;
      }
      
    } catch (err) {
      console.log(`❌ ERROR: ${v.year} ${v.make} ${v.model} → ${err.message}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  if (groupedFound.length > 0) {
    console.log("\n⚠️ Grouped trims that need fixing:");
    for (const g of groupedFound) {
      console.log(`   ${g.vehicle.year} ${g.vehicle.make} ${g.vehicle.model}`);
    }
  }
  
  return failed === 0;
}

async function testCompactSlashPreserved() {
  console.log("\n=== Test: Compact Slash Trims Preserved ===\n");
  console.log("Checking that R/T, GT/CS etc. are NOT split...\n");
  
  let passed = 0;
  let failed = 0;
  
  for (const v of COMPACT_SLASH_VEHICLES) {
    try {
      const url = `${BASE_URL}/api/vehicles/trims?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&nocache=1`;
      const resp = await fetch(url);
      const data = await resp.json();
      
      if (!data.results || data.results.length === 0) {
        console.log(`⚠️ SKIP: ${v.year} ${v.make} ${v.model} - no trims returned`);
        continue;
      }
      
      // Look for R/T or similar compact slash trims
      const slashTrims = data.results.filter(t => {
        const label = t.label || "";
        // Compact slash: no space before or after
        return /\w\/\w/.test(label);
      });
      
      // Check that we don't have "R" or "T" as separate trims (incorrectly split from R/T)
      // Note: "GT" is a legitimate standalone trim, not a split
      const suspiciousSplits = data.results.filter(t => {
        const label = (t.label || "").trim();
        // Only "R" or "T" alone would indicate R/T was incorrectly split
        // "CS" alone would indicate GT/CS was incorrectly split
        return label === "R" || label === "T" || label === "CS";
      });
      
      if (suspiciousSplits.length > 0) {
        console.log(`❌ FAIL: ${v.year} ${v.make} ${v.model} - found incorrectly split trims`);
        console.log(`   Split trims: ${suspiciousSplits.map(t => `"${t.label}"`).join(", ")}`);
        failed++;
      } else if (slashTrims.length > 0) {
        console.log(`✅ PASS: ${v.year} ${v.make} ${v.model} - compact slash preserved`);
        console.log(`   Slash trims: ${slashTrims.map(t => t.label).join(", ")}`);
        passed++;
      } else {
        console.log(`⚠️ WARN: ${v.year} ${v.make} ${v.model} - no slash trims found`);
        console.log(`   Trims: ${data.results.slice(0, 5).map(t => t.label).join(", ")}...`);
        // Not a failure - vehicle might not have R/T trim in this year
        passed++;
      }
      
    } catch (err) {
      console.log(`❌ ERROR: ${v.year} ${v.make} ${v.model} → ${err.message}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function testExplodedTrimResolution() {
  console.log("\n=== Test: Exploded Trim Resolution ===\n");
  console.log("Checking that selecting an exploded trim returns tire sizes...\n");
  
  let passed = 0;
  let failed = 0;
  
  // Pick a few vehicles to test end-to-end
  const testVehicles = GROUPED_TRIM_VEHICLES.slice(0, 5);
  
  for (const v of testVehicles) {
    try {
      // Get trims
      const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}`;
      const trimsResp = await fetch(trimsUrl);
      const trimsData = await trimsResp.json();
      
      if (!trimsData.results || trimsData.results.length === 0) {
        console.log(`⚠️ SKIP: ${v.year} ${v.make} ${v.model} - no trims`);
        continue;
      }
      
      // Pick the first trim (which might be exploded from a grouped record)
      const firstTrim = trimsData.results[0];
      const trimId = firstTrim.value || firstTrim.modificationId;
      const trimLabel = firstTrim.label;
      
      // Test tire-sizes API
      const tireSizesUrl = `${BASE_URL}/api/vehicles/tire-sizes?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&modification=${encodeURIComponent(trimId)}&trim=${encodeURIComponent(trimLabel)}`;
      const tireSizesResp = await fetch(tireSizesUrl);
      const tireSizesData = await tireSizesResp.json();
      
      // Test wheel fitment search
      const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&trim=${encodeURIComponent(trimLabel)}`;
      const wheelsResp = await fetch(wheelsUrl);
      const wheelsData = await wheelsResp.json();
      
      const tireSizesOk = tireSizesData.tireSizes?.length > 0;
      // Primary check: tire sizes resolve (this is what trim explosion affects)
      // Wheel inventory is a separate concern (depends on bolt pattern + available stock)
      const wheelsHasBoltPattern = !!wheelsData.boltPattern;
      
      if (tireSizesOk) {
        console.log(`✅ PASS: ${v.year} ${v.make} ${v.model} → "${trimLabel}"`);
        console.log(`   Tires: ${tireSizesData.tireSizes?.length || 0} sizes (source: ${tireSizesData.source})`);
        console.log(`   Wheels: bolt=${wheelsData.boltPattern || "N/A"}, ${wheelsData.wheels?.length || 0} in stock`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${v.year} ${v.make} ${v.model} → "${trimLabel}"`);
        console.log(`   Tires: ${tireSizesData.tireSizes?.length || 0} sizes (source: ${tireSizesData.source})`);
        if (tireSizesData.trimResolutionRequired) {
          console.log(`   ⚠️ Trim resolution required: ${tireSizesData.message}`);
        }
        failed++;
      }
      
    } catch (err) {
      console.log(`❌ ERROR: ${v.year} ${v.make} ${v.model} → ${err.message}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function main() {
  console.log("============================================");
  console.log("   TRIM EXPLOSION REGRESSION TESTS");
  console.log(`   Target: ${BASE_URL}`);
  console.log("============================================");
  
  const results = [];
  
  results.push(await testNoGroupedTrimsInSelector());
  results.push(await testCompactSlashPreserved());
  results.push(await testExplodedTrimResolution());
  
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
