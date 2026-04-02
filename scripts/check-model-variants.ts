import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  // Check all Chrysler 300 variants
  console.log("CHRYSLER 300 VARIANTS:");
  const chr = await db.execute(sql`
    SELECT DISTINCT model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE make = 'chrysler' AND (model LIKE '%300%')
    GROUP BY model
    ORDER BY model
  `);
  console.log(chr.rows);
  
  // Check if plain '300' exists
  const chr300 = await db.execute(sql`
    SELECT * FROM vehicle_fitments
    WHERE make = 'chrysler' AND model = '300'
    LIMIT 1
  `);
  console.log("Plain '300':", chr300.rows.length > 0 ? "EXISTS" : "DOES NOT EXIST");
  
  // Check F-350 variants
  console.log("\nFORD F-350 VARIANTS:");
  const f350 = await db.execute(sql`
    SELECT DISTINCT model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE make = 'ford' AND model LIKE '%f-350%'
    GROUP BY model
    ORDER BY model
  `);
  console.log(f350.rows);
  
  // Check if plain 'f-350' exists and what years
  const f350plain = await db.execute(sql`
    SELECT DISTINCT year FROM vehicle_fitments
    WHERE make = 'ford' AND model = 'f-350'
    ORDER BY year
  `);
  console.log("Plain 'f-350' years:", (f350plain.rows as any[]).map(r => r.year).join(", ") || "NONE");
  
  // Check F-250 variants
  console.log("\nFORD F-250 VARIANTS:");
  const f250 = await db.execute(sql`
    SELECT DISTINCT model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE make = 'ford' AND model LIKE '%f-250%'
    GROUP BY model
    ORDER BY model
  `);
  console.log(f250.rows);
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
