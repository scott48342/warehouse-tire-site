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
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'tundra'
    GROUP BY source
    ORDER BY cnt DESC
  `);
  console.log('Tundra by source:');
  sources.rows.forEach(row => console.log(`  ${row.source}: ${row.cnt}`));
  
  const sample = await pool.query(`
    SELECT year, display_trim
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'tundra'
    AND source NOT LIKE 'trim-research%'
    ORDER BY year DESC
    LIMIT 15
  `);
  console.log('\nSample records needing processing:');
  sample.rows.forEach(row => console.log(`  ${row.year} ${row.display_trim}`));
  
  await pool.end();
}

main();
