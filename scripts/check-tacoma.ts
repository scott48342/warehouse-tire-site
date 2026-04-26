import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const sources = await pool.query(`
    SELECT source, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'tacoma'
    GROUP BY source
  `);
  console.log('Sources for Toyota Tacoma:');
  sources.rows.forEach(row => console.log(`  ${row.source}: ${row.cnt}`));
  
  const total = await pool.query(`
    SELECT COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'tacoma'
  `);
  console.log(`Total Tacoma records: ${total.rows[0].cnt}`);
  
  // Sample records
  const sample = await pool.query(`
    SELECT year, display_trim, source, quality_tier
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'tacoma'
    ORDER BY year DESC
    LIMIT 10
  `);
  console.log('\nSample records:');
  sample.rows.forEach(row => console.log(`  ${row.year} ${row.display_trim} [${row.source}]`));
  
  await pool.end();
}

main();
