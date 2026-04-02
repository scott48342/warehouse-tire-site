import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function check() {
  // Check all 2008 Chrysler records
  const results = await db.execute(sql`
    SELECT model, display_trim, trim, bolt_pattern, center_bore
    FROM vehicle_fitments
    WHERE year = 2008 AND LOWER(make) LIKE '%chrysler%'
    ORDER BY model, display_trim
  `);
  
  console.log('2008 Chrysler records in DB:', results.rows.length);
  for (const r of results.rows as any[]) {
    console.log(`  - ${r.model} | ${r.display_trim || r.trim} | ${r.bolt_pattern} | ${r.center_bore}mm`);
  }
  
  // Check all Chrysler 300 records by year
  const all300 = await db.execute(sql`
    SELECT year, model, display_trim, COUNT(*) as trim_count
    FROM vehicle_fitments
    WHERE LOWER(make) LIKE '%chrysler%' AND LOWER(model) LIKE '%300%'
    GROUP BY year, model, display_trim
    ORDER BY year, model
  `);
  
  console.log('\nAll Chrysler 300 records by year:');
  const byYear: Record<number, string[]> = {};
  for (const r of all300.rows as any[]) {
    if (!byYear[r.year]) byYear[r.year] = [];
    byYear[r.year].push(`${r.model} ${r.display_trim || ''}`);
  }
  
  Object.keys(byYear).sort().forEach(year => {
    console.log(`  ${year}: ${byYear[Number(year)].length} trims - ${byYear[Number(year)].join(', ')}`);
  });
  
  process.exit(0);
}

check();
