import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const r = await pool.query(`
  SELECT sub_type, COUNT(*) as count 
  FROM accessories 
  WHERE category = 'tpms' AND in_stock = true 
  GROUP BY sub_type 
  ORDER BY count DESC
`);

console.log('TPMS in-stock counts (Schrader hidden):');
console.table(r.rows);

await pool.end();
