/**
 * Quick test for the 13 vehicles that failed in the 50-vehicle regression
 */

const BASE_URL = process.env.SHOP_URL || "https://shop.warehousetiredirect.com";

const FAILED_VEHICLES = [
  { year: 2007, make: "BMW", model: "328i", group: "older" },
  { year: 2021, make: "BMW", model: "330i", group: "multi-oem" },
  { year: 2018, make: "BMW", model: "440i xDrive", group: "staggered" },
  { year: 2020, make: "BMW", model: "M340i", group: "staggered" },
  { year: 2019, make: "Mercedes-Benz", model: "C300", group: "staggered" },
  { year: 2020, make: "Mercedes-Benz", model: "E350", group: "staggered" },
  { year: 2021, make: "Mercedes-Benz", model: "GLC 300", group: "staggered" },
  { year: 2022, make: "Mercedes-Benz", model: "GLE 350", group: "staggered" },
  { year: 2017, make: "BMW", model: "540i", group: "staggered" },
  { year: 2016, make: "Mercedes-Benz", model: "CLA 250", group: "staggered" },
  { year: 2023, make: "BMW", model: "430i Gran Coupe", group: "staggered" },
  { year: 2022, make: "Tesla", model: "Model 3 Long Range", group: "ev" },
  { year: 2022, make: "Hyundai", model: "Ioniq 5 SEL", group: "ev" },
];

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function testVehicle(v: typeof FAILED_VEHICLES[0]): Promise<{
  vehicle: string;
  trims: boolean;
  trimsCount: number;
  wheels: boolean;
  wheelsCount: number;
  error?: string;
}> {
  const { year, make, model } = v;
  const vehicleStr = `${year} ${make} ${model}`;
  
  try {
    // Test trims
    const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const trimsData = await fetchJson(trimsUrl);
    const trimsOk = trimsData.results && trimsData.results.length > 0;
    const trimsCount = trimsData.results?.length || 0;
    
    if (!trimsOk) {
      return { vehicle: vehicleStr, trims: false, trimsCount: 0, wheels: false, wheelsCount: 0, error: "No trims" };
    }
    
    // Test wheels with first trim
    const modificationId = trimsData.results[0].modificationId;
    const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modification=${encodeURIComponent(modificationId)}&pageSize=5`;
    const wheelsData = await fetchJson(wheelsUrl);
    const wheelsOk = wheelsData.results && wheelsData.results.length > 0;
    const wheelsCount = wheelsData.results?.length || 0;
    
    return {
      vehicle: vehicleStr,
      trims: trimsOk,
      trimsCount,
      wheels: wheelsOk,
      wheelsCount,
      error: !wheelsOk ? `${wheelsData.error || "No wheels"} (mode: ${wheelsData.fitment?.mode || "unknown"})` : undefined,
    };
  } catch (err: any) {
    return {
      vehicle: vehicleStr,
      trims: false,
      trimsCount: 0,
      wheels: false,
      wheelsCount: 0,
      error: err.message,
    };
  }
}

async function main() {
  console.log("🔬 Testing 13 Previously Failed Vehicles");
  console.log("═".repeat(80));
  console.log(`Target: ${BASE_URL}`);
  console.log("═".repeat(80));
  console.log();
  
  const results = [];
  
  for (const v of FAILED_VEHICLES) {
    const desc = `${v.year} ${v.make} ${v.model}`;
    process.stdout.write(`Testing ${desc.padEnd(40)} `);
    
    const result = await testVehicle(v);
    results.push(result);
    
    const status = result.trims && result.wheels ? "✅" : "❌";
    const details = result.trims && result.wheels 
      ? `(${result.trimsCount} trims, ${result.wheelsCount} wheels)`
      : `(${result.error})`;
    console.log(`${status} ${details}`);
  }
  
  console.log();
  console.log("═".repeat(80));
  console.log("SUMMARY");
  console.log("═".repeat(80));
  
  const passed = results.filter(r => r.trims && r.wheels).length;
  const failed = results.length - passed;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log();
    console.log("Failed vehicles:");
    results.filter(r => !r.trims || !r.wheels).forEach(r => {
      console.log(`  • ${r.vehicle}: ${r.error}`);
    });
  }
}

main().catch(console.error);
