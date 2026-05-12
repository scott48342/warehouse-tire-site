import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const r = await pool.query(`
  SELECT id, display_trim, modification_id FROM vehicle_fitments 
  WHERE year = 2007 AND LOWER(make) = 'bmw' AND LOWER(model) = '3 series'
`);
console.log('All 2007 BMW 3 Series records:');
r.rows.forEach(row => console.log(`  ${row.display_trim} | ${row.modification_id}`));
await pool.end();
