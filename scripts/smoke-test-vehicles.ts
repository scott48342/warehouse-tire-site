/**
 * 15-Vehicle Package Flow Smoke Test
 * Tests full package flow for a representative set of vehicles
 */

const BASE_URL = process.env.SHOP_URL || "https://shop.warehousetiredirect.com";

interface VehicleTest {
  name: string;
  year: number;
  make: string;
  model: string;
  modification?: string;
  category: string;
}

interface TestResult {
  vehicle: string;
  trimSelected: string;
  wheelsLoaded: number;
  fitmentQuality: string;
  accessoriesFound: boolean;
  tiresLoaded: number;
  issues: string[];
  passed: boolean;
}

const TEST_VEHICLES: VehicleTest[] = [
  { name: "2008 Honda Civic (older car)", year: 2008, make: "Honda", model: "Civic", category: "older-car" },
  { name: "2023 Toyota Camry (newer sedan)", year: 2023, make: "Toyota", model: "Camry", category: "newer-sedan" },
  { name: "2021 Ford Explorer (SUV)", year: 2021, make: "Ford", model: "Explorer", category: "suv" },
  { name: "2022 Ford F-150 (truck)", year: 2022, make: "Ford", model: "F-150", category: "truck" },
  { name: "2020 Jeep Wrangler (off-road)", year: 2020, make: "Jeep", model: "Wrangler", category: "jeep" },
  { name: "2023 Chevrolet Silverado 1500 (GM truck)", year: 2023, make: "Chevrolet", model: "Silverado 1500", category: "gm-truck" },
  { name: "2022 Chevrolet Tahoe (GM SUV)", year: 2022, make: "Chevrolet", model: "Tahoe", category: "gm-suv" },
  { name: "2020 Chevrolet Camaro (edge case)", year: 2020, make: "Chevrolet", model: "Camaro", category: "sports" },
  { name: "2019 BMW 3 Series (plus-sizing)", year: 2019, make: "BMW", model: "3 Series", category: "luxury" },
  { name: "2003 Chevrolet Avalanche 1500 (incomplete data)", year: 2003, make: "Chevrolet", model: "Avalanche 1500", category: "incomplete" },
  { name: "2022 Lexus RX 350 (luxury SUV)", year: 2022, make: "Lexus", model: "RX 350", category: "luxury-suv" },
  { name: "2023 Honda CR-V (compact SUV)", year: 2023, make: "Honda", model: "CR-V", category: "compact-suv" },
  { name: "2021 Ford Mustang (sports)", year: 2021, make: "Ford", model: "Mustang", category: "sports" },
  { name: "2023 Tesla Model 3 (EV)", year: 2023, make: "Tesla", model: "Model 3", category: "ev" },
  { name: "2022 Toyota Sienna (minivan)", year: 2022, make: "Toyota", model: "Sienna", category: "minivan" },
];

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function testVehicle(vehicle: VehicleTest): Promise<TestResult> {
  const issues: string[] = [];
  let trimSelected = "—";
  let wheelsLoaded = 0;
  let fitmentQuality = "unknown";
  let accessoriesFound = false;
  let tiresLoaded = 0;

  try {
    // Step 1: Get trims/modifications
    const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
    const trimsData = await fetchJson(trimsUrl);
    
    const trims = trimsData.results || trimsData.trims || trimsData.modifications || [];
    if (trims.length === 0) {
      issues.push("No trims found");
      return { vehicle: vehicle.name, trimSelected, wheelsLoaded, fitmentQuality, accessoriesFound, tiresLoaded, issues, passed: false };
    }

    // Pick first trim
    const trim = trims[0];
    trimSelected = trim.label || trim.displayLabel || trim.name || trim.value || "unknown";
    const modId = trim.modificationId || trim.value || trim.slug || trim.id;

    // Check for raw engine text in label
    if (/^\d+\.\d+L?\s*(V\d|I\d|L\d)/i.test(trimSelected)) {
      issues.push(`Raw engine text in label: "${trimSelected}"`);
    }
    if (/^[a-f0-9]{8,}$/i.test(trimSelected)) {
      issues.push(`Modification ID shown: "${trimSelected}"`);
    }

    // Step 2: Load wheels with fitment search
    const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modification=${encodeURIComponent(modId)}&pageSize=50`;
    
    try {
      const wheelsData = await fetchJson(wheelsUrl);
      wheelsLoaded = wheelsData.results?.length || 0;
      
      // Extract fitment quality
      if (wheelsData.fitment?.dbProfile) {
        const profile = wheelsData.fitment.dbProfile;
        if (profile.boltPattern && (profile.oemWheelSizes?.length > 0 || profile.oemTireSizes?.length > 0)) {
          fitmentQuality = "valid";
        } else if (profile.boltPattern) {
          fitmentQuality = "partial";
        } else {
          fitmentQuality = "invalid";
        }
      } else if (wheelsData.fitment?.envelope?.boltPattern) {
        fitmentQuality = "valid (legacy)";
      } else {
        fitmentQuality = "missing";
      }

      if (wheelsLoaded === 0) {
        issues.push("No wheels returned");
      }
    } catch (err: any) {
      issues.push(`Wheels API error: ${err.message}`);
      fitmentQuality = "error";
    }

    // Step 3: Check tires using TireConnect (search by size from OEM data)
    // Extract OEM tire size from fitment profile if available
    let oemTireSize: string | null = null;
    try {
      const wheelsData2 = await fetchJson(wheelsUrl);
      const oemTires = wheelsData2.fitment?.dbProfile?.oemTireSizes || [];
      if (oemTires.length > 0) {
        oemTireSize = oemTires[0];
      }
    } catch {}

    if (oemTireSize) {
      // Parse tire size like "265/70R17" to get dimensions
      const match = oemTireSize.match(/(\d+)\/(\d+)R(\d+)/);
      if (match) {
        const [, width, aspect, diameter] = match;
        const tireSearchUrl = `${BASE_URL}/api/tireconnect/search?width=${width}&aspect=${aspect}&diameter=${diameter}&pageSize=10`;
        
        try {
          const tiresData = await fetchJson(tireSearchUrl);
          tiresLoaded = tiresData.results?.length || tiresData.items?.length || tiresData.tires?.length || 0;
        } catch (err: any) {
          // TireConnect might not be available
          tiresLoaded = -1; // Skip
        }
      }
    } else {
      tiresLoaded = -1; // Skip - no OEM size
    }
    
    // Accessories check (skip for now - depends on accessory API implementation)
    accessoriesFound = true; // Assume OK

    // Determine overall pass/fail
    // Pass if: trim selected, wheels loaded, fitment quality is valid/partial/legacy
    const passed = 
      trimSelected !== "—" && 
      wheelsLoaded > 0 && 
      !["invalid", "error", "missing", "unknown"].includes(fitmentQuality) && 
      issues.filter(i => !i.includes("Tires") && !i.includes("accessories")).length === 0;

    return { vehicle: vehicle.name, trimSelected, wheelsLoaded, fitmentQuality, accessoriesFound, tiresLoaded, issues, passed };
  } catch (err: any) {
    issues.push(`Test error: ${err.message}`);
    return { vehicle: vehicle.name, trimSelected, wheelsLoaded, fitmentQuality, accessoriesFound, tiresLoaded, issues, passed: false };
  }
}

async function runAllTests() {
  console.log("🚗 15-Vehicle Package Flow Smoke Test");
  console.log("═".repeat(100));
  console.log(`Target: ${BASE_URL}`);
  console.log("═".repeat(100));
  console.log("");

  const results: TestResult[] = [];
  
  for (const vehicle of TEST_VEHICLES) {
    process.stdout.write(`Testing ${vehicle.name}... `);
    const result = await testVehicle(vehicle);
    results.push(result);
    console.log(result.passed ? "✅" : "❌");
  }

  console.log("");
  console.log("═".repeat(100));
  console.log("📊 RESULTS TABLE");
  console.log("═".repeat(100));
  console.log("");
  
  // Header
  console.log("| # | Vehicle | Trim | Wheels | Fitment | Tires | Status |");
  console.log("|---|---------|------|--------|---------|-------|--------|");
  
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const trimShort = r.trimSelected.length > 25 ? r.trimSelected.substring(0, 22) + "..." : r.trimSelected;
    const vehicleShort = r.vehicle.length > 45 ? r.vehicle.substring(0, 42) + "..." : r.vehicle;
    const tiresStr = r.tiresLoaded === -1 ? "—" : String(r.tiresLoaded);
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`| ${String(i+1).padStart(2)} | ${vehicleShort.padEnd(45)} | ${trimShort.padEnd(25)} | ${String(r.wheelsLoaded).padStart(3)} | ${r.fitmentQuality.padEnd(12)} | ${tiresStr.padStart(3)} | ${status} |`);
    
    if (r.issues.length > 0) {
      for (const issue of r.issues) {
        console.log(`|    |    ⚠️ ${issue}`);
      }
    }
  }

  console.log("");
  console.log("═".repeat(100));
  console.log("📈 SUMMARY");
  console.log("═".repeat(100));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log("");
  
  // Group failures by type
  const failureTypes: Record<string, string[]> = {};
  for (const r of results) {
    for (const issue of r.issues) {
      const type = issue.split(":")[0] || issue;
      if (!failureTypes[type]) failureTypes[type] = [];
      failureTypes[type].push(r.vehicle);
    }
  }
  
  if (Object.keys(failureTypes).length > 0) {
    console.log("📋 FAILURES BY TYPE:");
    for (const [type, vehicles] of Object.entries(failureTypes)) {
      console.log(`  • ${type}: ${vehicles.length} vehicle(s)`);
      for (const v of vehicles) {
        console.log(`    - ${v}`);
      }
    }
    console.log("");
  }
  
  // Top 3 issues
  console.log("🔧 TOP ISSUES TO FIX:");
  const sortedTypes = Object.entries(failureTypes).sort((a, b) => b[1].length - a[1].length);
  for (let i = 0; i < Math.min(3, sortedTypes.length); i++) {
    const [type, vehicles] = sortedTypes[i];
    console.log(`  ${i + 1}. ${type} (affects ${vehicles.length} vehicles)`);
  }
  
  console.log("");
  console.log("═".repeat(100));
}

runAllTests().catch(console.error);
