import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  SELECT sub_type, COUNT(*) as count 
  FROM accessories 
  WHERE category = 'lighting' 
  GROUP BY sub_type 
  ORDER BY count DESC
`);

console.log('Current lighting sub_types:');
console.table(result.rows);

await pool.end();
