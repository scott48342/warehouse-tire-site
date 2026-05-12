import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Fix the 328i record that has wrong display_trim
await pool.query(`
  UPDATE vehicle_fitments 
  SET display_trim = '328i'
  WHERE modification_id = 'bmw-3-series-328i-9947bf10'
`);
console.log('✅ Fixed display_trim for bmw-3-series-328i-9947bf10');

// Also fix the 335i record
await pool.query(`
  UPDATE vehicle_fitments 
  SET display_trim = '335i'
  WHERE modification_id = 'bmw-3-series-335i-48819b4e'
`);
console.log('✅ Fixed display_trim for bmw-3-series-335i-48819b4e');

// Verify
const r = await pool.query(`
  SELECT display_trim, modification_id FROM vehicle_fitments 
  WHERE year = 2007 AND LOWER(make) = 'bmw' AND LOWER(model) = '3 series'
  ORDER BY display_trim
`);
console.log('\nUpdated trims:');
r.rows.forEach(row => console.log(`  ${row.display_trim} | ${row.modification_id}`));

await pool.end();
