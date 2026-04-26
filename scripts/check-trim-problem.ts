import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Count records updated by these scripts (source = google-ai-overview)
  const updated = await pool.query(`
    SELECT make, COUNT(*) as count, COUNT(DISTINCT model) as models, COUNT(DISTINCT display_trim) as trims
    FROM vehicle_fitments
    WHERE source = 'google-ai-overview'
    GROUP BY make
    ORDER BY count DESC
  `);
  
  console.log("=== Records updated with model-level data (need trim fixes) ===");
  let total = 0;
  for (const row of updated.rows) {
    console.log(`${row.make}: ${row.count} records, ${row.models} models, ${row.trims} unique trims`);
    total += parseInt(row.count);
  }
  console.log(`TOTAL: ${total} records need trim-specific research\n`);
  
  // Sample to show the problem - multiple trims with same data
  const sample = await pool.query(`
    SELECT year, make, model, display_trim, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE source = 'google-ai-overview'
      AND make = 'Ford' AND model = 'Mustang'
    ORDER BY year DESC, display_trim
    LIMIT 10
  `);
  
  console.log("=== Example: Ford Mustang trims all have same wheel data ===");
  for (const row of sample.rows) {
    const wheels = JSON.parse(row.oem_wheel_sizes || "[]");
    const diameters = wheels.map((w: any) => w.diameter).join(", ");
    console.log(`${row.year} ${row.display_trim}: ${diameters || "none"}`);
  }
  
  // Check how many distinct trim values exist per model
  const trimVariety = await pool.query(`
    SELECT make, model, COUNT(DISTINCT display_trim) as trim_count
    FROM vehicle_fitments
    WHERE source = 'google-ai-overview'
    GROUP BY make, model
    HAVING COUNT(DISTINCT display_trim) > 3
    ORDER BY trim_count DESC
    LIMIT 20
  `);
  
  console.log("\n=== Models with most trim variety (>3 trims) ===");
  for (const row of trimVariety.rows) {
    console.log(`${row.make} ${row.model}: ${row.trim_count} trims`);
  }
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
