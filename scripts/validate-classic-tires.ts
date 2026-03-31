/**
 * Classic Tire Validation Sweep
 * 
 * Tests all classic platforms across multiple wheel diameters
 * Run: npx tsx scripts/validate-classic-tires.ts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface TireSearchResult {
  isClassicVehicle: boolean;
  matchMode: string;
  tireSizesSearched: string[];
  classicInfo?: {
    stockTireSize: string;
    upsizeSizes: string[];
  };
  results: any[];
  oemTireSizes?: string[];
}

interface ValidationResult {
  vehicle: string;
  wheelDiameter: number;
  isClassic: boolean;
  matchMode: string;
  sizesSearched: number;
  tiresFound: number;
  stockTire?: string;
  sampleSizes: string[];
  status: "PASS" | "FAIL" | "WARN";
  note?: string;
}

const CLASSIC_VEHICLES = [
  { year: 1969, make: "chevrolet", model: "camaro", name: "1969 Camaro" },
  { year: 1970, make: "chevrolet", model: "chevelle", name: "1970 Chevelle" },
  { year: 1971, make: "dodge", model: "challenger", name: "1971 Challenger" },
  { year: 1969, make: "dodge", model: "charger", name: "1969 Charger" },
  { year: 1967, make: "ford", model: "mustang", name: "1967 Mustang" },
  { year: 1977, make: "pontiac", model: "firebird", name: "1977 Trans Am" },
];

const WHEEL_DIAMETERS = [15, 16, 17, 18];

const MODERN_VEHICLES = [
  { year: 2024, make: "toyota", model: "camry", name: "2024 Toyota Camry" },
  { year: 2024, make: "ford", model: "f-150", name: "2024 Ford F-150" },
];

async function testTireSearch(
  year: number,
  make: string,
  model: string,
  wheelDiameter: number
): Promise<TireSearchResult | null> {
  const url = `${BASE_URL}/api/tires/search?year=${year}&make=${make}&model=${model}&wheelDiameter=${wheelDiameter}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  HTTP ${res.status} for ${year} ${make} ${model} @ ${wheelDiameter}"`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.error(`  Fetch error: ${err.message}`);
    return null;
  }
}

async function validateClassicVehicle(
  vehicle: { year: number; make: string; model: string; name: string },
  wheelDiameter: number
): Promise<ValidationResult> {
  const result = await testTireSearch(
    vehicle.year,
    vehicle.make,
    vehicle.model,
    wheelDiameter
  );
  
  if (!result) {
    return {
      vehicle: vehicle.name,
      wheelDiameter,
      isClassic: false,
      matchMode: "ERROR",
      sizesSearched: 0,
      tiresFound: 0,
      sampleSizes: [],
      status: "FAIL",
      note: "API request failed",
    };
  }
  
  const sizesSearched = result.tireSizesSearched?.length || 0;
  const tiresFound = result.results?.length || 0;
  const sampleSizes = (result.tireSizesSearched || []).slice(0, 3);
  
  let status: "PASS" | "FAIL" | "WARN" = "PASS";
  let note: string | undefined;
  
  // Check if classic was detected
  if (!result.isClassicVehicle) {
    status = "FAIL";
    note = "Not detected as classic vehicle";
  }
  // Check if tires were found
  else if (tiresFound === 0) {
    status = "WARN";
    note = "No tires found (may be stock issue)";
  }
  // Check match mode for non-stock diameters
  else if (wheelDiameter > 15 && result.matchMode !== "classic-upsize") {
    status = "WARN";
    note = `Expected classic-upsize mode, got ${result.matchMode}`;
  }
  
  return {
    vehicle: vehicle.name,
    wheelDiameter,
    isClassic: result.isClassicVehicle,
    matchMode: result.matchMode,
    sizesSearched,
    tiresFound,
    stockTire: result.classicInfo?.stockTireSize,
    sampleSizes,
    status,
    note,
  };
}

async function validateModernVehicle(
  vehicle: { year: number; make: string; model: string; name: string }
): Promise<ValidationResult> {
  const result = await testTireSearch(vehicle.year, vehicle.make, vehicle.model, 17);
  
  if (!result) {
    return {
      vehicle: vehicle.name,
      wheelDiameter: 17,
      isClassic: false,
      matchMode: "ERROR",
      sizesSearched: 0,
      tiresFound: 0,
      sampleSizes: [],
      status: "FAIL",
      note: "API request failed",
    };
  }
  
  let status: "PASS" | "FAIL" | "WARN" = "PASS";
  let note: string | undefined;
  
  // Modern vehicles should NOT be classic
  if (result.isClassicVehicle) {
    status = "FAIL";
    note = "Incorrectly detected as classic!";
  }
  
  return {
    vehicle: vehicle.name,
    wheelDiameter: 17,
    isClassic: result.isClassicVehicle,
    matchMode: result.matchMode,
    sizesSearched: result.tireSizesSearched?.length || 0,
    tiresFound: result.results?.length || 0,
    sampleSizes: (result.tireSizesSearched || []).slice(0, 3),
    status,
    note,
  };
}

async function main() {
  console.log("=".repeat(80));
  console.log("CLASSIC TIRE VALIDATION SWEEP");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("=".repeat(80));
  
  const allResults: ValidationResult[] = [];
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  
  // Test classic vehicles
  console.log("\n📋 CLASSIC VEHICLES\n");
  
  for (const vehicle of CLASSIC_VEHICLES) {
    console.log(`\n${vehicle.name}:`);
    
    for (const diameter of WHEEL_DIAMETERS) {
      const result = await validateClassicVehicle(vehicle, diameter);
      allResults.push(result);
      
      const icon = result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️" : "❌";
      const sizesStr = result.sampleSizes.join(", ") || "none";
      const modeStr = (result.matchMode || "unknown").padEnd(14);
      
      console.log(
        `  ${icon} ${diameter}": ${modeStr} | ` +
        `${result.tiresFound.toString().padStart(3)} tires | ` +
        `sizes: ${sizesStr}` +
        (result.note ? ` [${result.note}]` : "")
      );
      
      if (result.status === "PASS") passCount++;
      else if (result.status === "WARN") warnCount++;
      else failCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Test modern vehicles
  console.log("\n" + "=".repeat(80));
  console.log("📋 MODERN VEHICLES (should NOT be classic)\n");
  
  for (const vehicle of MODERN_VEHICLES) {
    const result = await validateModernVehicle(vehicle);
    allResults.push(result);
    
    const icon = result.status === "PASS" ? "✅" : "❌";
    console.log(
      `${icon} ${vehicle.name}: isClassic=${result.isClassic}, ` +
      `mode=${result.matchMode}, tires=${result.tiresFound}` +
      (result.note ? ` [${result.note}]` : "")
    );
    
    if (result.status === "PASS") passCount++;
    else if (result.status === "WARN") warnCount++;
    else failCount++;
  }
  
  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ PASS: ${passCount}`);
  console.log(`⚠️ WARN: ${warnCount}`);
  console.log(`❌ FAIL: ${failCount}`);
  console.log(`Total:  ${allResults.length}`);
  
  // Stock tire reference
  console.log("\n" + "=".repeat(80));
  console.log("STOCK TIRE REFERENCE");
  console.log("=".repeat(80));
  
  const stockTires = new Map<string, string>();
  for (const r of allResults) {
    if (r.stockTire && !stockTires.has(r.vehicle)) {
      stockTires.set(r.vehicle, r.stockTire);
    }
  }
  
  for (const [vehicle, stock] of stockTires) {
    console.log(`  ${vehicle}: ${stock}`);
  }
  
  // Exit with error if any failures
  if (failCount > 0) {
    console.log("\n❌ VALIDATION FAILED");
    process.exit(1);
  } else {
    console.log("\n✅ VALIDATION PASSED");
    process.exit(0);
  }
}

main().catch(console.error);
