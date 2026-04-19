import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check light_bar products
const result = await pool.query(`
  SELECT sku, title, in_stock, sub_type
  FROM accessories 
  WHERE sub_type IN ('light_bar', 'light bar')
  ORDER BY in_stock DESC, title
  LIMIT 30
`);

console.log('Light bar products (first 30):');
console.table(result.rows);

// Count in_stock vs out of stock
const counts = await pool.query(`
  SELECT in_stock, COUNT(*) as count 
  FROM accessories 
  WHERE sub_type IN ('light_bar', 'light bar')
  GROUP BY in_stock
`);
console.log('\nStock status for light_bars:');
console.table(counts.rows);

await pool.end();
