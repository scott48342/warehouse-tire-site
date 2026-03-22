/**
 * Test script for the 7 vehicles that failed with "Import succeeded but profile not found"
 * 
 * These vehicles failed due to trim/modificationId mismatch in the legacy system.
 * After the refactor to modificationId-first, they should resolve via:
 * - modificationIdDb (if already cached)
 * - modificationIdApi (fetch + import + read)
 */

const BASE_URL = process.env.SHOP_URL || "https://shop.warehousetiredirect.com";

const IMPORT_FAILURE_VEHICLES = [
  { year: 2007, make: "BMW", model: "328i", note: "Legacy import stored trim='325i'" },
  { year: 2021, make: "BMW", model: "330i", note: "Multi-OEM, imported as '330e'" },
  { year: 2018, make: "BMW", model: "440i xDrive", note: "Staggered fitment" },
  { year: 2017, make: "BMW", model: "540i", note: "5-series alias" },
  { year: 2023, make: "BMW", model: "430i Gran Coupe", note: "4-series variant" },
  { year: 2022, make: "Hyundai", model: "Ioniq 5 SEL", note: "EV" },
  { year: 2023, make: "Kia", model: "EV6 GT-Line", note: "EV" },
];

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 300)}`);
  }
  return res.json();
}

async function testVehicle(v: typeof IMPORT_FAILURE_VEHICLES[0]): Promise<{
  vehicle: string;
  passed: boolean;
  resolutionPath?: string;
  wheelsCount?: number;
  boltPattern?: string;
  error?: string;
}> {
  const { year, make, model } = v;
  const vehicleStr = `${year} ${make} ${model}`;
  
  try {
    // Step 1: Get trims
    const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const trimsData = await fetchJson(trimsUrl);
    
    if (!trimsData.results || trimsData.results.length === 0) {
      return { vehicle: vehicleStr, passed: false, error: "No trims returned" };
    }
    
    // Step 2: Get wheels with first trim's modificationId
    const modificationId = trimsData.results[0].modificationId;
    const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modification=${encodeURIComponent(modificationId)}&pageSize=5&debug=1`;
    const wheelsData = await fetchJson(wheelsUrl);
    
    const resolutionPath = wheelsData.fitment?.resolutionPath || wheelsData.summary?.resolutionPath || "unknown";
    const wheelsCount = wheelsData.results?.length || 0;
    const boltPattern = wheelsData.fitment?.envelope?.boltPattern || wheelsData.fitment?.dbProfile?.boltPattern || null;
    
    if (!wheelsData.results || wheelsData.results.length === 0) {
      return { 
        vehicle: vehicleStr, 
        passed: false, 
        resolutionPath,
        wheelsCount: 0,
        boltPattern,
        error: wheelsData.error || "No wheels returned",
      };
    }
    
    return {
      vehicle: vehicleStr,
      passed: true,
      resolutionPath,
      wheelsCount,
      boltPattern,
    };
  } catch (err: any) {
    return {
      vehicle: vehicleStr,
      passed: false,
      error: err.message,
    };
  }
}

async function main() {
  console.log("🔬 Testing 7 Import Failure Vehicles (ModificationId-First Refactor)");
  console.log("═".repeat(90));
  console.log(`Target: ${BASE_URL}`);
  console.log("═".repeat(90));
  console.log();
  
  const results = [];
  
  for (const v of IMPORT_FAILURE_VEHICLES) {
    const desc = `${v.year} ${v.make} ${v.model}`;
    process.stdout.write(`Testing ${desc.padEnd(35)} `);
    
    const result = await testVehicle(v);
    results.push({ ...result, note: v.note });
    
    const status = result.passed ? "✅" : "❌";
    const details = result.passed 
      ? `${result.resolutionPath} | ${result.wheelsCount} wheels | ${result.boltPattern}`
      : result.error?.substring(0, 50);
    console.log(`${status} ${details}`);
  }
  
  console.log();
  console.log("═".repeat(90));
  console.log("SUMMARY");
  console.log("═".repeat(90));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  // Resolution path breakdown
  const pathCounts = new Map<string, number>();
  for (const r of results) {
    if (r.resolutionPath) {
      pathCounts.set(r.resolutionPath, (pathCounts.get(r.resolutionPath) || 0) + 1);
    }
  }
  
  console.log();
  console.log("Resolution Paths:");
  for (const [path, count] of pathCounts.entries()) {
    console.log(`  ${path}: ${count}`);
  }
  
  if (failed > 0) {
    console.log();
    console.log("Failed vehicles:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  • ${r.vehicle}: ${r.error}`);
    });
  }
  
  // Exit code based on success
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
