import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  // Check what Ford models exist for 2015
  const result = await db.execute(sql`
    SELECT DISTINCT model FROM vehicle_fitments
    WHERE make = 'ford' AND year = 2015
    ORDER BY model
  `);
  console.log("Ford models for 2015:", (result.rows as any[]).map(r => r.model));
  
  // Check F-350 specifically
  const f350 = await db.execute(sql`
    SELECT year, model, display_trim, bolt_pattern FROM vehicle_fitments
    WHERE make = 'ford' AND model LIKE '%f-350%' AND year = 2015
    LIMIT 5
  `);
  console.log("\nF-350 2015 records:", f350.rows.length);
  if (f350.rows.length > 0) {
    console.log("Sample:", f350.rows[0]);
  }
  
  // Check years available for f-350-super-duty
  const years = await db.execute(sql`
    SELECT DISTINCT year FROM vehicle_fitments
    WHERE make = 'ford' AND model = 'f-350-super-duty'
    ORDER BY year
  `);
  console.log("\nYears for f-350-super-duty:", (years.rows as any[]).map(r => r.year).join(", "));
  
  process.exit(0);
}

main().catch(console.error);
