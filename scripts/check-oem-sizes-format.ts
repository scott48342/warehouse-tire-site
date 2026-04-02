import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  // Sample various formats
  const samples = await db.execute(sql`
    SELECT make, model, year, display_trim, oem_wheel_sizes, source
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL
      AND oem_wheel_sizes != '[]'::jsonb
    ORDER BY RANDOM()
    LIMIT 20
  `);
  
  console.log("SAMPLE OEM_WHEEL_SIZES FORMATS:");
  console.log("─────────────────────────────────────────");
  
  for (const r of samples.rows as any[]) {
    console.log(`\n${r.year} ${r.make} ${r.model} (${r.display_trim}) [${r.source}]:`);
    const sizes = r.oem_wheel_sizes;
    if (Array.isArray(sizes) && sizes.length > 0) {
      console.log(`  Type: ${typeof sizes[0]}`);
      console.log(`  First: ${JSON.stringify(sizes[0])}`);
      console.log(`  Count: ${sizes.length}`);
    } else {
      console.log(`  Raw: ${JSON.stringify(sizes)}`);
    }
  }
  
  // Count by format
  const byFormat = await db.execute(sql`
    SELECT 
      CASE 
        WHEN oem_wheel_sizes IS NULL THEN 'null'
        WHEN oem_wheel_sizes = '[]'::jsonb THEN 'empty_array'
        WHEN oem_wheel_sizes::text LIKE '%diameter%' THEN 'object_with_diameter'
        WHEN oem_wheel_sizes::text LIKE '%[object Object]%' THEN 'corrupted_object'
        ELSE 'other'
      END as format,
      COUNT(*) as count
    FROM vehicle_fitments
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  
  console.log("\n\nFORMAT COUNTS:");
  console.log("─────────────────────────────────────────");
  for (const r of byFormat.rows as any[]) {
    console.log(`  ${r.format}: ${r.count}`);
  }
  
  process.exit(0);
}

main().catch(console.error);
