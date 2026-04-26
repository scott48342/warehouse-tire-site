/**
 * Check Ford incomplete records
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const r = await pool.query(`
    SELECT DISTINCT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ford' 
      AND (quality_tier != 'complete' OR quality_tier IS NULL)
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  console.log('=== FORD INCOMPLETE MODELS ===');
  r.rows.forEach(row => console.log(`${row.model}: ${row.cnt}`));
  console.log('Total:', r.rows.reduce((a,b) => a + parseInt(b.cnt), 0));
  await pool.end();
}

main().catch(console.error);
