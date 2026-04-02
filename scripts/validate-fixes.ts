import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VALIDATION - BEFORE/AFTER COMPARISON");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Test vehicles as specified
  const testVehicles = [
    // Luxury
    { make: "bmw", model: "3-series", year: 2022 },
    { make: "bmw", model: "3-series", year: 2020 },
    { make: "mercedes", model: "gle", year: 2023 },
    { make: "mercedes", model: "gle", year: 2021 },
    // Truck
    { make: "ford", model: "f-150", year: 2024 },
    { make: "ford", model: "f-150", year: 2022 },
    // SUVs
    { make: "toyota", model: "rav4", year: 2024 },
    { make: "honda", model: "cr-v", year: 2023 },
    { make: "jeep", model: "wrangler", year: 2022 },
    // Car
    { make: "toyota", model: "camry", year: 2023 },
    { make: "honda", model: "civic", year: 2023 },
    // More trucks
    { make: "chevrolet", model: "silverado-1500", year: 2023 },
    { make: "ram", model: "1500", year: 2023 },
    // More luxury
    { make: "audi", model: "a4", year: 2022 },
    { make: "lexus", model: "rx", year: 2023 },
  ];

  console.log("TESTING 15 VEHICLES:\n");
  
  let allPass = true;
  
  for (const v of testVehicles) {
    const result = await db.execute(sql`
      SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm, 
             thread_size, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments
      WHERE year = ${v.year} AND make = ${v.make} AND model = ${v.model}
      LIMIT 1
    `);
    
    const row = result.rows[0] as any;
    
    if (!row) {
      console.log(`❌ ${v.year} ${v.make} ${v.model}: NOT FOUND`);
      allPass = false;
      continue;
    }
    
    const hasWheelSizes = row.oem_wheel_sizes && 
                          Array.isArray(row.oem_wheel_sizes) && 
                          row.oem_wheel_sizes.length > 0 &&
                          !JSON.stringify(row.oem_wheel_sizes).includes("[object Object]");
    
    const hasCoreData = row.bolt_pattern && row.center_bore_mm && row.thread_size;
    
    if (hasCoreData && hasWheelSizes) {
      console.log(`✅ ${v.year} ${v.make} ${v.model} (${row.display_trim}):`);
      console.log(`   Bolt: ${row.bolt_pattern}, CB: ${row.center_bore_mm}mm, Thread: ${row.thread_size}`);
      
      // Parse wheel sizes
      const wheelSizes = row.oem_wheel_sizes;
      let sizeSummary = "";
      if (typeof wheelSizes[0] === "object") {
        const diameters = [...new Set(wheelSizes.map((w: any) => w.diameter))].sort((a: number, b: number) => a - b);
        sizeSummary = diameters.map((d: number) => `${d}"`).join(", ");
      } else if (typeof wheelSizes[0] === "string") {
        sizeSummary = wheelSizes.slice(0, 3).join(", ");
      }
      console.log(`   Wheels: ${sizeSummary}`);
    } else if (hasCoreData) {
      console.log(`⚠️ ${v.year} ${v.make} ${v.model}: Core data OK, but wheel sizes missing`);
      allPass = false;
    } else {
      console.log(`❌ ${v.year} ${v.make} ${v.model}: Missing core fitment data`);
      allPass = false;
    }
    console.log();
  }
  
  // Summary stats
  const stats = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN bolt_pattern IS NOT NULL AND center_bore_mm IS NOT NULL THEN 1 END) as has_core,
      COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL 
                  AND oem_wheel_sizes != '[]'::jsonb
                  AND oem_wheel_sizes::text NOT LIKE '%[object Object]%' 
            THEN 1 END) as has_wheel_sizes
    FROM vehicle_fitments
  `);
  
  const s = stats.rows[0] as any;
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  OVERALL COVERAGE");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`Total records:           ${s.total}`);
  console.log(`With core fitment data:  ${s.has_core} (${Math.round(s.has_core/s.total*100)}%)`);
  console.log(`With wheel sizes:        ${s.has_wheel_sizes} (${Math.round(s.has_wheel_sizes/s.total*100)}%)`);
  console.log();
  
  if (allPass) {
    console.log("✅ ALL TEST VEHICLES PASS");
  } else {
    console.log("⚠️ SOME TEST VEHICLES HAVE ISSUES");
  }
  
  process.exit(0);
}

main().catch(console.error);
