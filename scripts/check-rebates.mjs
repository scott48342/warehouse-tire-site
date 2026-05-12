import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const r = await pool.query(`
  SELECT brand, headline FROM site_rebates 
  ORDER BY brand
`);
console.log('Active rebates:');
r.rows.forEach(row => console.log(`  - ${row.brand}: ${row.headline}`));
await pool.end();
