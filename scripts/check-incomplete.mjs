import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query(`
    SELECT make, model, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make IN ('Dodge', 'Buick', 'Cadillac')
    AND (quality_tier IS NULL OR quality_tier != 'complete')
    GROUP BY make, model
    ORDER BY make, cnt DESC
  `);
  res.rows.forEach(r => console.log(`${r.make}|${r.model}|${r.cnt}`));
  console.log(`\nTotal: ${res.rows.reduce((a, r) => a + parseInt(r.cnt), 0)} records`);
  await pool.end();
}
run();
