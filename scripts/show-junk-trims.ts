import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  // Find examples of junk trims (hash-like patterns)
  const junk = await db.execute(sql`
    SELECT year, make, model, modification_id, display_trim, source
    FROM vehicle_fitments
    WHERE modification_id ~ '^[a-f0-9]{8,}$'
       OR modification_id ~ '^s_[a-f0-9]{8}$'
       OR display_trim ~ '^[a-f0-9]{8,}$'
       OR display_trim IS NULL
       OR display_trim = ''
    ORDER BY make, model, year
    LIMIT 25
  `);

  console.log("JUNK TRIM EXAMPLES:");
  for (const r of junk.rows as any[]) {
    console.log(`  ${r.year} ${r.make} ${r.model}: trim='${r.display_trim}' modId='${r.modification_id}' [${r.source}]`);
  }

  // Find examples of placeholder trims (Base with generated ID)
  const placeholder = await db.execute(sql`
    SELECT year, make, model, modification_id, display_trim, source
    FROM vehicle_fitments
    WHERE display_trim = 'Base' 
      AND modification_id ~ '[a-f0-9]{8}'
    ORDER BY make, model, year
    LIMIT 15
  `);

  console.log("\nPLACEHOLDER TRIM EXAMPLES:");
  for (const r of placeholder.rows as any[]) {
    console.log(`  ${r.year} ${r.make} ${r.model}: modId='${r.modification_id}' [${r.source}]`);
  }

  // Count by source
  const bySrc = await db.execute(sql`
    SELECT source, COUNT(*) as count,
           SUM(CASE WHEN display_trim = 'Base' THEN 1 ELSE 0 END) as base_count
    FROM vehicle_fitments
    GROUP BY source
    ORDER BY count DESC
  `);

  console.log("\nRECORDS BY SOURCE:");
  for (const r of bySrc.rows as any[]) {
    console.log(`  ${r.source}: ${r.count} total, ${r.base_count} Base trims`);
  }

  process.exit(0);
}

main().catch(console.error);
