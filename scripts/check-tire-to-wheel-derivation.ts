import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  // Check BMW 5-series as example - has tire sizes but no wheel sizes
  const bmw = await db.execute(sql`
    SELECT year, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE make = 'bmw' AND model = '5-series'
    ORDER BY year
    LIMIT 10
  `);
  
  console.log("BMW 5-Series tire data:");
  for (const r of bmw.rows as any[]) {
    console.log(`  ${r.year} ${r.display_trim}:`);
    console.log(`    Tire sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`    Wheel sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
  }
  
  // Check Mercedes GLE
  const merc = await db.execute(sql`
    SELECT year, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE make = 'mercedes' AND model = 'gle'
    ORDER BY year
    LIMIT 10
  `);
  
  console.log("\nMercedes GLE tire data:");
  for (const r of merc.rows as any[]) {
    console.log(`  ${r.year} ${r.display_trim}:`);
    console.log(`    Tire sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`    Wheel sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
  }
  
  // Find records with tire sizes but no wheel sizes
  const hasTiresNoWheels = await db.execute(sql`
    SELECT make, model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]'::jsonb
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes::text LIKE '%[object Object]%')
    GROUP BY make, model
    ORDER BY count DESC
    LIMIT 20
  `);
  
  console.log("\nModels with tire sizes but NO wheel sizes:");
  for (const r of hasTiresNoWheels.rows as any[]) {
    console.log(`  ${r.make} ${r.model}: ${r.count} records`);
  }
  
  process.exit(0);
}

main().catch(console.error);
