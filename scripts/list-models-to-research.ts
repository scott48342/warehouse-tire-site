import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Getting unique make+model combinations to research...\n");
  
  // Get all unique make+model combos that have google-ai-overview data
  const result = await pool.query(`
    SELECT 
      make, 
      model,
      COUNT(*) as record_count,
      COUNT(DISTINCT display_trim) as trim_count,
      MIN(year) as min_year,
      MAX(year) as max_year,
      ARRAY_AGG(DISTINCT display_trim ORDER BY display_trim) as trims
    FROM vehicle_fitments
    WHERE source = 'google-ai-overview'
    GROUP BY make, model
    ORDER BY make, model
  `);
  
  console.log(`Found ${result.rows.length} unique make+model combinations\n`);
  console.log("=== Models to Research ===\n");
  
  let totalRecords = 0;
  const researchList: any[] = [];
  
  for (const row of result.rows) {
    const trimList = row.trims.slice(0, 5).join(", ") + (row.trims.length > 5 ? ` (+${row.trims.length - 5} more)` : "");
    console.log(`${row.make} ${row.model} (${row.min_year}-${row.max_year})`);
    console.log(`  Records: ${row.record_count}, Trims: ${row.trim_count}`);
    console.log(`  Trims: ${trimList}`);
    console.log();
    
    totalRecords += parseInt(row.record_count);
    researchList.push({
      make: row.make,
      model: row.model,
      minYear: row.min_year,
      maxYear: row.max_year,
      recordCount: parseInt(row.record_count),
      trimCount: row.trim_count,
      trims: row.trims
    });
  }
  
  console.log("=== Summary ===");
  console.log(`Total models to research: ${result.rows.length}`);
  console.log(`Total records to update: ${totalRecords}`);
  console.log(`Average records per model: ${(totalRecords / result.rows.length).toFixed(1)}`);
  
  // Save the list to a JSON file for the research script
  const fs = await import("fs");
  fs.writeFileSync(
    "scripts/research-list.json",
    JSON.stringify(researchList, null, 2)
  );
  console.log("\nSaved research list to scripts/research-list.json");
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
