/**
 * Spot test: dbProfile fallback fix
 * Tests 5 vehicles that should now work with the fallback path
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface SpotTestVehicle {
  name: string;
  year: number;
  make: string;
  model: string;
  modificationId: string;
}

const TEST_VEHICLES: SpotTestVehicle[] = [
  { name: "2022 Ford F-150 XL", year: 2022, make: "Ford", model: "F-150", modificationId: "s_d93c231d" },
  { name: "2020 Jeep Wrangler Rubicon", year: 2020, make: "Jeep", model: "Wrangler", modificationId: "s_4c9c8d7a" },
  { name: "2023 Chevrolet Silverado 1500 WT", year: 2023, make: "Chevrolet", model: "Silverado 1500", modificationId: "s_0b9d1e2a" },
  { name: "2022 Chevrolet Tahoe LS", year: 2022, make: "Chevrolet", model: "Tahoe", modificationId: "s_a1b2c3d4" },
  { name: "2003 Chevrolet Avalanche 1500 Base", year: 2003, make: "Chevrolet", model: "Avalanche 1500", modificationId: "s_e5f6a7b8" },
];

interface TestResult {
  vehicle: string;
  wheelsCount: number;
  fitmentSource: string;
  validationMode: string;
  boltPattern: string | null;
  surefit: number;
  specfit: number;
  extended: number;
  passed: boolean;
  error?: string;
}

async function testVehicle(v: SpotTestVehicle): Promise<TestResult> {
  try {
    // First get trims to find correct modificationId
    const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}`;
    const trimsRes = await fetch(trimsUrl);
    const trimsData = await trimsRes.json();
    
    const trims = trimsData.results || [];
    if (trims.length === 0) {
      return {
        vehicle: v.name,
        wheelsCount: 0,
        fitmentSource: "error",
        validationMode: "skipped",
        boltPattern: null,
        surefit: 0,
        specfit: 0,
        extended: 0,
        passed: false,
        error: "No trims found",
      };
    }
    
    // Use first trim's modificationId
    const modId = trims[0].modificationId || trims[0].value;
    
    // Now test fitment-search
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&modification=${encodeURIComponent(modId)}&pageSize=50`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.error) {
      return {
        vehicle: v.name,
        wheelsCount: 0,
        fitmentSource: "error",
        validationMode: "skipped",
        boltPattern: null,
        surefit: 0,
        specfit: 0,
        extended: 0,
        passed: false,
        error: data.error,
      };
    }
    
    const wheelsCount = data.results?.length || 0;
    const fitmentSource = data.fitment?.fitmentSource || data.summary?.fitmentSource || "unknown";
    const validationMode = data.fitment?.validationMode || data.summary?.validationMode || "unknown";
    const boltPattern = data.fitment?.envelope?.boltPattern || data.fitment?.dbProfile?.boltPattern || null;
    const surefit = data.summary?.surefit || 0;
    const specfit = data.summary?.specfit || 0;
    const extended = data.summary?.extended || 0;
    
    return {
      vehicle: v.name,
      wheelsCount,
      fitmentSource,
      validationMode,
      boltPattern,
      surefit,
      specfit,
      extended,
      passed: wheelsCount > 0,
    };
  } catch (err: any) {
    return {
      vehicle: v.name,
      wheelsCount: 0,
      fitmentSource: "error",
      validationMode: "skipped",
      boltPattern: null,
      surefit: 0,
      specfit: 0,
      extended: 0,
      passed: false,
      error: err.message,
    };
  }
}

async function main() {
  console.log("🧪 Spot Test: dbProfile Fallback Fix");
  console.log("═".repeat(80));
  console.log(`Target: ${BASE_URL}`);
  console.log("═".repeat(80));
  console.log("");
  
  const results: TestResult[] = [];
  
  for (const v of TEST_VEHICLES) {
    process.stdout.write(`Testing ${v.name}... `);
    const result = await testVehicle(v);
    results.push(result);
    console.log(result.passed ? "✅" : "❌");
  }
  
  console.log("");
  console.log("═".repeat(80));
  console.log("📊 RESULTS");
  console.log("═".repeat(80));
  console.log("");
  
  console.log("| Vehicle | Wheels | Fitment Source | Validation | Bolt Pattern | Surefit | Status |");
  console.log("|---------|--------|----------------|------------|--------------|---------|--------|");
  
  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`| ${r.vehicle.padEnd(35)} | ${String(r.wheelsCount).padStart(4)} | ${r.fitmentSource.padEnd(14)} | ${r.validationMode.padEnd(10)} | ${(r.boltPattern || "—").padEnd(12)} | ${String(r.surefit).padStart(4)} | ${status} |`);
    if (r.error) {
      console.log(`|   ⚠️ Error: ${r.error}`);
    }
  }
  
  console.log("");
  console.log("═".repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log("");
    console.log("⚠️ Failed vehicles:");
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.vehicle}: ${r.error || "0 wheels returned"}`);
    }
  }
  
  console.log("");
}

main().catch(console.error);
