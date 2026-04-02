import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  // Check M3 years
  const m3 = await db.execute(sql`
    SELECT DISTINCT year FROM vehicle_fitments WHERE make = 'bmw' AND model = 'm3' ORDER BY year
  `);
  console.log("BMW M3 years:", (m3.rows as any[]).map(r => r.year).join(", ") || "NONE");
  
  // Check silverado-2500-hd years
  const silver = await db.execute(sql`
    SELECT DISTINCT year FROM vehicle_fitments WHERE make = 'chevrolet' AND model = 'silverado-2500-hd' ORDER BY year
  `);
  console.log("Silverado-2500-HD years:", (silver.rows as any[]).map(r => r.year).join(", ") || "NONE");
  
  // Check silverado-2500hd years (without second hyphen)
  const silver2 = await db.execute(sql`
    SELECT DISTINCT year FROM vehicle_fitments WHERE make = 'chevrolet' AND model = 'silverado-2500hd' ORDER BY year
  `);
  console.log("Silverado-2500HD years:", (silver2.rows as any[]).map(r => r.year).join(", ") || "NONE");
  
  process.exit(0);
}

main().catch(console.error);
