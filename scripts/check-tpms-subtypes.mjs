import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check current sub_types for TPMS
const subtypes = await pool.query(`
  SELECT sub_type, COUNT(*) as count 
  FROM accessories 
  WHERE category = 'tpms'
  GROUP BY sub_type
  ORDER BY count DESC
`);
console.log('Current TPMS sub_types:');
console.table(subtypes.rows);

// Sample titles to understand the products
const samples = await pool.query(`
  SELECT sku, title, sub_type
  FROM accessories 
  WHERE category = 'tpms' AND in_stock = true
  ORDER BY title
  LIMIT 50
`);
console.log('\nSample TPMS products:');
console.table(samples.rows);

await pool.end();
