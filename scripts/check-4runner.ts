import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const models = await pool.query(`
    SELECT DISTINCT model, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND (LOWER(model) LIKE '%runner%' OR LOWER(model) LIKE '%4-run%' OR LOWER(model) = '4runner')
    GROUP BY model
    ORDER BY cnt DESC
  `);
  console.log('4Runner model variations:');
  models.rows.forEach(row => console.log(`  "${row.model}": ${row.cnt}`));

  const sources = await pool.query(`
    SELECT source, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND (LOWER(model) LIKE '%runner%' OR LOWER(model) LIKE '%4-run%' OR LOWER(model) = '4runner')
    GROUP BY source
    ORDER BY cnt DESC
  `);
  console.log('\n4Runner by source:');
  sources.rows.forEach(row => console.log(`  ${row.source}: ${row.cnt}`));
  
  await pool.end();
}

main();
