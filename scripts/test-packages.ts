/**
 * Test Script: Package Engine Validation
 * 
 * Tests the package engine for specified vehicles:
 * - 2024 Ford F-150
 * - 2024 Toyota Camry
 * - 2024 Honda Civic
 * - 2024 Chevrolet Silverado 1500
 * - 2024 Toyota RAV4
 * 
 * Run: npx tsx scripts/test-packages.ts
 */

import { getRecommendedPackages, type PackageRecommendationResult } from "../src/lib/packages/engine";

const TEST_VEHICLES = [
  { year: 2024, make: "Ford", model: "F-150" },
  { year: 2024, make: "Toyota", model: "Camry" },
  { year: 2024, make: "Honda", model: "Civic" },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500" },
  { year: 2024, make: "Toyota", model: "RAV4" },
];

async function testVehicle(vehicle: { year: number; make: string; model: string }) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  console.log("=".repeat(60));

  try {
    const result = await getRecommendedPackages(vehicle);
    
    console.log(`\nFitment Data:`);
    console.log(`  Bolt Pattern: ${result.fitment.boltPattern || "N/A"}`);
    console.log(`  OEM Diameters: ${result.fitment.oemDiameters.join(", ") || "N/A"}`);
    console.log(`  OEM Tire Sizes: ${result.fitment.oemTireSizes.slice(0, 3).join(", ") || "N/A"}`);
    console.log(`  Offset Range: ${result.fitment.offsetRange.min ?? "?"}-${result.fitment.offsetRange.max ?? "?"}mm`);

    console.log(`\nPackages Generated: ${result.packages.length}`);
    
    if (result.packages.length === 0) {
      console.log("  ⚠️ No packages generated - may need fitment data");
      return { vehicle, success: false, reason: "No packages", packages: [] };
    }

    for (const pkg of result.packages) {
      console.log(`\n  📦 ${pkg.name} (${pkg.category})`);
      console.log(`     Wheel: ${pkg.wheel.brand} ${pkg.wheel.model}`);
      console.log(`     Size: ${pkg.sizeSpec}`);
      console.log(`     Total: $${pkg.totalPrice.toLocaleString()}`);
      console.log(`     Safe: ${pkg.fitmentValidation.safe ? "✅" : "❌"}`);
      console.log(`     Diameter Change: ${pkg.fitmentValidation.overallDiameterChange ?? 0}%`);
      console.log(`     Availability: ${pkg.availability}`);
      
      if (!pkg.fitmentValidation.safe) {
        console.log(`     Notes: ${pkg.fitmentValidation.notes.join("; ")}`);
      }
    }

    console.log(`\nTiming:`);
    console.log(`  Fitment: ${result.timing.fitmentMs}ms`);
    console.log(`  Wheels: ${result.timing.wheelsMs}ms`);
    console.log(`  Packages: ${result.timing.packagesMs}ms`);
    console.log(`  Total: ${result.timing.totalMs}ms`);

    return { 
      vehicle, 
      success: true, 
      packages: result.packages,
      fitment: result.fitment 
    };
  } catch (err: any) {
    console.error(`  ❌ Error: ${err.message}`);
    return { vehicle, success: false, reason: err.message, packages: [] };
  }
}

async function main() {
  console.log("Package Engine Test Suite");
  console.log("=".repeat(60));

  const results = [];

  for (const vehicle of TEST_VEHICLES) {
    const result = await testVehicle(vehicle);
    results.push(result);
  }

  // Summary
  console.log("\n\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    console.log("\nFailed vehicles:");
    for (const f of failed) {
      console.log(`  - ${f.vehicle.year} ${f.vehicle.make} ${f.vehicle.model}: ${f.reason}`);
    }
  }

  // Sample JSON output for first 3 successful
  console.log("\n\nSample JSON Output (first 3 vehicles):");
  console.log("=".repeat(60));
  
  const sampleOutput = successful.slice(0, 3).map(r => ({
    vehicle: r.vehicle,
    fitment: r.fitment,
    packagesCount: r.packages.length,
    packages: r.packages.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      wheel: {
        brand: p.wheel.brand,
        model: p.wheel.model,
        size: `${p.wheel.diameter}x${p.wheel.width}`,
        price: p.wheel.price,
      },
      tire: {
        size: p.tire.size,
        brand: p.tire.brand,
        price: p.tire.price,
      },
      totalPrice: p.totalPrice,
      safe: p.fitmentValidation.safe,
    })),
  }));

  console.log(JSON.stringify(sampleOutput, null, 2));
}

main().catch(console.error);
