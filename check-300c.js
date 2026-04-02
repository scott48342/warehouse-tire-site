const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Check what's in fitment DB for 2008 Chrysler 300
  console.log('=== 2008 Chrysler 300 in fitment DB ===');
  const res = await pool.query(`
    SELECT display_trim, modification_id, source, bolt_pattern
    FROM vehicle_fitments
    WHERE year = 2008 AND make = 'chrysler' AND model LIKE '%300%'
    ORDER BY display_trim
  `);
  
  if (res.rows.length === 0) {
    console.log('  (no records found)');
  } else {
    for (const r of res.rows) {
      console.log(`  ${r.display_trim} | ${r.source} | ${r.bolt_pattern}`);
    }
  }

  // Also check what model names exist for Chrysler 300
  console.log('\n=== Chrysler 300 model variants ===');
  const models = await pool.query(`
    SELECT DISTINCT model, year
    FROM vehicle_fitments
    WHERE make = 'chrysler' AND model LIKE '%300%'
    ORDER BY year DESC, model
  `);
  for (const r of models.rows) {
    console.log(`  ${r.year} ${r.model}`);
  }
  
  await pool.end();
}
main();
