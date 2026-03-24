#!/usr/bin/env npx tsx

/**
 * Query Wheel-Size API for 10 random vehicles and output all fields
 */

import {
  getAllVehicleData,
  getModifications,
  getVehicleData,
  resolveMakeModel,
} from "../src/lib/wheelSizeApi";
import * as fs from "fs";

const TEST_VEHICLES = [
  { year: 2024, make: "Ford", model: "F-150" },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500" },
  { year: 2024, make: "Ram", model: "1500" },
  { year: 2024, make: "Jeep", model: "Wrangler" },
  { year: 2024, make: "Toyota", model: "Tacoma" },
  { year: 2024, make: "Toyota", model: "Camry" },
  { year: 2024, make: "Honda", model: "Accord" },
  { year: 2024, make: "BMW", model: "3 Series" },
  { year: 2024, make: "Ford", model: "Mustang" },
  { year: 2024, make: "Chevrolet", model: "Corvette" },
];

async function main() {
  const results: any[] = [];
  
  console.log("Querying Wheel-Size API for 10 vehicles...\n");
  
  for (const vehicle of TEST_VEHICLES) {
    console.log(`\n─────────────────────────────────────────`);
    console.log(`Querying: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    console.log(`─────────────────────────────────────────`);
    
    try {
      // Resolve make/model to slugs
      const resolved = await resolveMakeModel(vehicle.make, vehicle.model);
      if (!resolved) {
        console.log(`  ❌ Could not resolve make/model`);
        results.push({
          input: vehicle,
          error: "Could not resolve make/model",
        });
        continue;
      }
      
      console.log(`  Make slug: ${resolved.makeSlug}`);
      console.log(`  Model slug: ${resolved.modelSlug}`);
      
      // Get modifications (all engine variants)
      const modifications = await getModifications(
        resolved.makeSlug,
        resolved.modelSlug,
        vehicle.year
      );
      
      console.log(`  Found ${modifications.length} modifications`);
      
      // Filter to US market
      const usMods = modifications.filter(m => m.regions?.includes("usdm"));
      console.log(`  US market modifications: ${usMods.length}`);
      
      if (usMods.length === 0 && modifications.length > 0) {
        // Fall back to first modification if no US-specific
        console.log(`  (Using first modification as fallback)`);
      }
      
      const targetMod = usMods[0] || modifications[0];
      
      if (!targetMod) {
        console.log(`  ❌ No modifications found`);
        results.push({
          input: vehicle,
          resolved,
          error: "No modifications found",
        });
        continue;
      }
      
      console.log(`  Using modification: ${targetMod.slug}`);
      console.log(`  Modification name: ${targetMod.name}`);
      
      // Get full vehicle data
      const vehicleData = await getVehicleData(
        resolved.makeSlug,
        resolved.modelSlug,
        vehicle.year,
        targetMod.slug
      );
      
      if (!vehicleData) {
        console.log(`  ❌ No vehicle data returned`);
        results.push({
          input: vehicle,
          resolved,
          modification: targetMod,
          error: "No vehicle data returned",
        });
        continue;
      }
      
      console.log(`  ✅ Got vehicle data`);
      
      // Log some key fields
      console.log(`  Bolt pattern: ${vehicleData.technical?.bolt_pattern}`);
      console.log(`  Center bore: ${vehicleData.technical?.centre_bore}`);
      console.log(`  Wheel setups: ${vehicleData.wheels?.length || 0}`);
      
      results.push({
        input: vehicle,
        resolved,
        modification: targetMod,
        allModifications: modifications,
        usModifications: usMods,
        vehicleData,
      });
      
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
      results.push({
        input: vehicle,
        error: err.message,
      });
    }
  }
  
  // Write results to file
  const output = {
    generatedAt: new Date().toISOString(),
    totalVehicles: TEST_VEHICLES.length,
    successCount: results.filter(r => r.vehicleData).length,
    errorCount: results.filter(r => r.error).length,
    vehicles: results,
  };
  
  const outputPath = "wheelsize-sample-results.json";
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n═════════════════════════════════════════`);
  console.log(`Results written to: ${outputPath}`);
  console.log(`Success: ${output.successCount} / ${output.totalVehicles}`);
  console.log(`═════════════════════════════════════════\n`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
