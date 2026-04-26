import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Connecting to database...");
  
  // Get a sample of what trim data looks like
  const sample = await pool.query(`
    SELECT DISTINCT year, make, model, display_trim, 
           oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb as has_wheels
    FROM vehicle_fitments
    WHERE source = 'google-ai-overview'
    ORDER BY make, model, year, display_trim
    LIMIT 30
  `);
  
  console.log("\n=== Sample of records with trims ===");
  for (const row of sample.rows) {
    console.log(`${row.year} ${row.make} ${row.model} [${row.display_trim}] - wheels: ${row.has_wheels}`);
  }
  
  // Count unique year/make/model/trim combinations that need fixing
  const counts = await pool.query(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT (year || '|' || make || '|' || model || '|' || COALESCE(display_trim, ''))) as unique_combos
    FROM vehicle_fitments
    WHERE source = 'google-ai-overview'
  `);
  
  console.log("\n=== Counts ===");
  console.log("Total records with google-ai-overview source:", counts.rows[0].total_records);
  console.log("Unique year/make/model/trim combos:", counts.rows[0].unique_combos);
  
  // Show breakdown by make
  const byMake = await pool.query(`
    SELECT make, 
           COUNT(*) as records,
           COUNT(DISTINCT (year || '|' || model || '|' || COALESCE(display_trim, ''))) as unique_trims
    FROM vehicle_fitments
    WHERE source = 'google-ai-overview'
    GROUP BY make
    ORDER BY records DESC
  `);
  
  console.log("\n=== Breakdown by Make ===");
  for (const row of byMake.rows) {
    console.log(`${row.make}: ${row.records} records, ${row.unique_trims} unique year/model/trim combos`);
  }
  
  await pool.end();
  console.log("\nDone.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
