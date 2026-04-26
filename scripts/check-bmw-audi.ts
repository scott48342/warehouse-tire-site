import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const bmw = await pool.query(`SELECT DISTINCT model FROM vehicle_fitments WHERE LOWER(make) = 'bmw' AND quality_tier != 'complete' ORDER BY model`);
  const audi = await pool.query(`SELECT DISTINCT model FROM vehicle_fitments WHERE LOWER(make) = 'audi' AND quality_tier != 'complete' ORDER BY model`);
  
  console.log('BMW models needing work:', bmw.rows.map(r => r.model).join(', '));
  console.log('Audi models needing work:', audi.rows.map(r => r.model).join(', '));
  
  const bmwCount = await pool.query(`SELECT COUNT(*) FROM vehicle_fitments WHERE LOWER(make) = 'bmw' AND quality_tier != 'complete'`);
  const audiCount = await pool.query(`SELECT COUNT(*) FROM vehicle_fitments WHERE LOWER(make) = 'audi' AND quality_tier != 'complete'`);
  
  console.log('BMW incomplete count:', bmwCount.rows[0].count);
  console.log('Audi incomplete count:', audiCount.rows[0].count);
  
  await pool.end();
}

main().catch(console.error);
