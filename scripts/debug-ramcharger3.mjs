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
    SELECT id, year, make, model, display_trim, quality_tier
    FROM vehicle_fitments
    WHERE make = 'Dodge' AND model = 'Ramcharger' AND quality_tier != 'complete'
    ORDER BY year
  `);
  
  console.log('Incomplete Ramcharger records:', res.rows.length);
  
  for (const r of res.rows) {
    console.log(`Year: ${r.year} (type: ${typeof r.year})`);
    
    const yearStart = 1974;
    const yearEnd = 1993;
    
    console.log(`  Testing: ${r.year} >= ${yearStart}? ${r.year >= yearStart} (types: ${typeof r.year} vs ${typeof yearStart})`);
    console.log(`  Testing: ${r.year} <= ${yearEnd}? ${r.year <= yearEnd}`);
    console.log(`  String comparison: "${r.year}" >= "${yearStart}"? ${"" + r.year >= "" + yearStart}`);
    console.log('');
  }
  
  await pool.end();
}

run();
