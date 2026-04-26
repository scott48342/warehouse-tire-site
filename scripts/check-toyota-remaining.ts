import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Get models that actually need processing (NOT trim-research/verified)
  const models = await pool.query(`
    SELECT model, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND source NOT LIKE 'trim-research%'
      AND source NOT LIKE 'verified%'
    GROUP BY model
    HAVING COUNT(*) > 0
    ORDER BY cnt DESC
    LIMIT 20
  `);
  
  console.log('Toyota models ACTUALLY needing processing:');
  let total = 0;
  models.rows.forEach(row => {
    console.log(`  ${row.model}: ${row.cnt}`);
    total += parseInt(row.cnt);
  });
  console.log(`\nTotal: ${total} records`);

  // Count already done
  const done = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND (source LIKE 'trim-research%' OR source LIKE 'verified%')
  `);
  console.log(`Already processed: ${done.rows[0].cnt}`);
  
  await pool.end();
}

main();
