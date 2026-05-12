import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const r = await pool.query(`
  SELECT year, display_trim, certification_status 
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'ford' AND LOWER(model) = 'edge'
  ORDER BY year
`);
console.log('Ford Edge records:', r.rows.length);
if (r.rows.length > 0) {
  const years = [...new Set(r.rows.map(x => x.year))].sort();
  console.log('Years covered:', years.join(', '));
} else {
  console.log('No Edge records found!');
}
await pool.end();
