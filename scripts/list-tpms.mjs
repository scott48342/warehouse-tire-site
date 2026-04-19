import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const r = await pool.query(`
  SELECT sku, title, brand 
  FROM accessories 
  WHERE category = 'tpms' AND in_stock = true
  ORDER BY brand, sku
`);

console.log('All in-stock TPMS products:');
console.table(r.rows);

await pool.end();
