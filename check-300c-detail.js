const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Check specifically 2008 300c
  console.log('=== 2008 Chrysler 300c trims ===');
  const res = await pool.query(`
    SELECT display_trim, modification_id, source, bolt_pattern
    FROM vehicle_fitments
    WHERE year = 2008 AND make = 'chrysler' AND model = '300c'
    ORDER BY display_trim
  `);
  
  if (res.rows.length === 0) {
    console.log('  (no records for "300c")');
  } else {
    for (const r of res.rows) {
      console.log(`  ${r.display_trim} | ${r.source} | ${r.bolt_pattern}`);
    }
  }

  // Also check just "300"
  console.log('\n=== 2008 Chrysler 300 trims ===');
  const res2 = await pool.query(`
    SELECT display_trim, modification_id, source, bolt_pattern
    FROM vehicle_fitments
    WHERE year = 2008 AND make = 'chrysler' AND model = '300'
    ORDER BY display_trim
  `);
  
  if (res2.rows.length === 0) {
    console.log('  (no records for "300")');
  } else {
    for (const r of res2.rows) {
      console.log(`  ${r.display_trim} | ${r.source} | ${r.bolt_pattern}`);
    }
  }

  // Check what the trims API would return (simulating with model aliases)
  console.log('\n=== Model aliases check ===');
  const aliases = await pool.query(`
    SELECT DISTINCT model 
    FROM vehicle_fitments 
    WHERE make = 'chrysler' 
      AND (model = '300' OR model = '300c' OR model = '300-c')
      AND year = 2008
  `);
  console.log('Models in DB for 2008 Chrysler matching 300/300c:');
  for (const r of aliases.rows) {
    console.log(`  "${r.model}"`);
  }
  
  await pool.end();
}
main();
