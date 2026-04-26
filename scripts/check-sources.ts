import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check all unique sources
  const sources = await pool.query(`
    SELECT DISTINCT source
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'tundra'
    ORDER BY source
  `);
  console.log('All Tundra sources:');
  sources.rows.forEach(row => console.log(`  "${row.source}"`));

  // Check sample of records that are NOT trim-research
  const records = await pool.query(`
    SELECT year, display_trim, source
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'tundra'
    ORDER BY source, year DESC
    LIMIT 20
  `);
  console.log('\nSample Tundra records:');
  records.rows.forEach(row => console.log(`  ${row.year} ${row.display_trim} [${row.source}]`));
  
  await pool.end();
}

main();
