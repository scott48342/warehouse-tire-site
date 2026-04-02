import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { sql } from "drizzle-orm";

async function analyze() {
  // Get sources of existing data
  const sources = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM vehicle_fitments
    GROUP BY source
    ORDER BY count DESC
  `);

  console.log("DATA SOURCES:");
  for (const row of sources.rows as any[]) {
    console.log(`  ${row.source}: ${row.count} records`);
  }

  // Get a sample of F-150 data to understand structure
  const sample = await db.execute(sql`
    SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm, 
           thread_size, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make = 'ford' AND model = 'f-150'
    ORDER BY year DESC
    LIMIT 3
  `);

  console.log("\nSAMPLE F-150 DATA:");
  for (const row of sample.rows as any[]) {
    console.log(JSON.stringify(row, null, 2));
  }

  // Check for platform sharing (same specs across years)
  const platforms = await db.execute(sql`
    SELECT make, model, bolt_pattern, center_bore_mm, thread_size,
           MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as year_count
    FROM vehicle_fitments
    GROUP BY make, model, bolt_pattern, center_bore_mm, thread_size
    HAVING COUNT(DISTINCT year) > 5
    ORDER BY year_count DESC
    LIMIT 20
  `);

  console.log("\nPLATFORM SHARING (same specs across years):");
  for (const row of platforms.rows as any[]) {
    console.log(`  ${row.make} ${row.model}: ${row.bolt_pattern}, ${row.center_bore_mm}mm CB, ${row.min_year}-${row.max_year} (${row.year_count} years)`);
  }

  process.exit(0);
}

analyze().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
