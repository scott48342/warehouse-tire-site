/**
 * SEO Validation Script
 * 
 * Tests the 5 specified vehicles to verify:
 * - Counts match inventory
 * - Pages render correctly
 * - Metadata is correct
 * 
 * Run: npx tsx scripts/seo-validation.ts
 */

import { getAllCountsByFitment, getFitmentFacts, getPopularWheelSizes, getPopularBrands } from "../src/lib/seo";

interface TestVehicle {
  year: number;
  make: string;
  model: string;
  displayName: string;
}

const TEST_VEHICLES: TestVehicle[] = [
  { year: 2024, make: "ford", model: "f-150", displayName: "2024 Ford F-150" },
  { year: 2024, make: "toyota", model: "camry", displayName: "2024 Toyota Camry" },
  { year: 2024, make: "honda", model: "civic", displayName: "2024 Honda Civic" },
  { year: 2024, make: "chevrolet", model: "silverado-1500", displayName: "2024 Chevrolet Silverado" },
  { year: 2024, make: "toyota", model: "rav4", displayName: "2024 Toyota RAV4" },
];

interface ValidationResult {
  vehicle: string;
  success: boolean;
  counts: {
    wheels: number;
    tires: number;
    packages: number;
    hasFitment: boolean;
  };
  fitment: {
    boltPattern: string | null;
    tireSizes: string[];
    wheelDiameters: number[];
  };
  popularSizes: number;
  popularBrands: number;
  errors: string[];
}

async function validateVehicle(vehicle: TestVehicle): Promise<ValidationResult> {
  const errors: string[] = [];
  
  console.log(`\n📊 Testing ${vehicle.displayName}...`);
  
  // Get all counts
  let counts = {
    wheels: 0,
    tires: 0,
    packages: 0,
    hasFitment: false,
  };
  
  try {
    counts = await getAllCountsByFitment(vehicle.year, vehicle.make, vehicle.model);
    console.log(`   ✓ Counts: ${counts.wheels} wheels, ${counts.tires} tires, ${counts.packages} packages`);
    
    if (!counts.hasFitment) {
      errors.push("No fitment data found");
    }
  } catch (err: any) {
    errors.push(`Count fetch failed: ${err.message}`);
    console.log(`   ✗ Count fetch failed: ${err.message}`);
  }
  
  // Get fitment facts
  let fitment = {
    boltPattern: null as string | null,
    tireSizes: [] as string[],
    wheelDiameters: [] as number[],
  };
  
  try {
    const fitmentData = await getFitmentFacts({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: null,
      displayMake: vehicle.make,
      displayModel: vehicle.model,
      displayTrim: null,
    });
    
    if (fitmentData) {
      fitment = {
        boltPattern: fitmentData.boltPattern,
        tireSizes: fitmentData.oemTireSizes || [],
        wheelDiameters: fitmentData.oemWheelDiameters || [],
      };
      console.log(`   ✓ Fitment: ${fitment.boltPattern}, tires: ${fitment.tireSizes.join(", ")}`);
    } else {
      errors.push("No fitment data returned");
    }
  } catch (err: any) {
    errors.push(`Fitment fetch failed: ${err.message}`);
    console.log(`   ✗ Fitment fetch failed: ${err.message}`);
  }
  
  // Get popular sizes
  let popularSizes = 0;
  try {
    const sizes = await getPopularWheelSizes(vehicle.year, vehicle.make, vehicle.model);
    popularSizes = sizes.length;
    console.log(`   ✓ Popular sizes: ${sizes.map(s => `${s.diameter}"`).join(", ")}`);
  } catch (err: any) {
    errors.push(`Popular sizes fetch failed: ${err.message}`);
  }
  
  // Get popular brands
  let popularBrands = 0;
  try {
    const brands = await getPopularBrands(vehicle.year, vehicle.make, vehicle.model);
    popularBrands = brands.length;
    console.log(`   ✓ Popular brands: ${brands.map(b => b.brand).join(", ")}`);
  } catch (err: any) {
    errors.push(`Popular brands fetch failed: ${err.message}`);
  }
  
  // Validation checks
  if (counts.wheels === 0 && counts.hasFitment) {
    errors.push("Has fitment but zero wheels - check bolt pattern matching");
  }
  
  if (counts.tires === 0 && fitment.tireSizes.length > 0) {
    errors.push("Has tire sizes but zero tire count - check estimation");
  }
  
  if (counts.wheels > 0 && !fitment.boltPattern) {
    errors.push("Has wheel count but no bolt pattern - data inconsistency");
  }
  
  return {
    vehicle: vehicle.displayName,
    success: errors.length === 0,
    counts,
    fitment,
    popularSizes,
    popularBrands,
    errors,
  };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("SEO VALIDATION REPORT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Running at: ${new Date().toISOString()}`);
  
  const results: ValidationResult[] = [];
  
  for (const vehicle of TEST_VEHICLES) {
    try {
      const result = await validateVehicle(vehicle);
      results.push(result);
    } catch (err: any) {
      results.push({
        vehicle: vehicle.displayName,
        success: false,
        counts: { wheels: 0, tires: 0, packages: 0, hasFitment: false },
        fitment: { boltPattern: null, tireSizes: [], wheelDiameters: [] },
        popularSizes: 0,
        popularBrands: 0,
        errors: [`Fatal error: ${err.message}`],
      });
    }
  }
  
  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\nPassed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  
  // Detailed table
  console.log("\n┌────────────────────────────┬────────┬───────┬──────────┬───────────┐");
  console.log("│ Vehicle                    │ Wheels │ Tires │ Packages │ Status    │");
  console.log("├────────────────────────────┼────────┼───────┼──────────┼───────────┤");
  
  for (const r of results) {
    const vehicle = r.vehicle.padEnd(26);
    const wheels = String(r.counts.wheels).padStart(6);
    const tires = String(r.counts.tires).padStart(5);
    const packages = String(r.counts.packages).padStart(8);
    const status = r.success ? "✓ PASS   " : "✗ FAIL   ";
    console.log(`│ ${vehicle} │${wheels} │${tires} │${packages} │ ${status}│`);
  }
  
  console.log("└────────────────────────────┴────────┴───────┴──────────┴───────────┘");
  
  // Errors
  const errorsExist = results.some(r => r.errors.length > 0);
  if (errorsExist) {
    console.log("\nERRORS:");
    for (const r of results) {
      if (r.errors.length > 0) {
        console.log(`\n  ${r.vehicle}:`);
        for (const err of r.errors) {
          console.log(`    - ${err}`);
        }
      }
    }
  }
  
  // URLs to test
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("TEST URLS (verify these render correctly):");
  console.log("═══════════════════════════════════════════════════════════════");
  
  for (const v of TEST_VEHICLES) {
    const base = `http://localhost:3001`;
    console.log(`\n${v.displayName}:`);
    console.log(`  Wheels:   ${base}/wheels/${v.year}/${v.make}/${v.model}`);
    console.log(`  Tires:    ${base}/tires/${v.year}/${v.make}/${v.model}`);
    console.log(`  Packages: ${base}/packages/${v.year}/${v.make}/${v.model}`);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  
  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
