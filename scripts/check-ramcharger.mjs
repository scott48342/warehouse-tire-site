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
    SELECT year, make, model, display_trim, quality_tier
    FROM vehicle_fitments
    WHERE make = 'Dodge' AND model = 'Ramcharger'
    ORDER BY year
  `);
  console.log('All Ramcharger records:');
  res.rows.forEach(r => console.log(`${r.year} ${r.model} "${r.display_trim || '(null)'}" - ${r.quality_tier || '(null)'}`));
  await pool.end();
}
run();
