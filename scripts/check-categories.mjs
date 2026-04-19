import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

console.log("Distinct categories and sub_types:");
const cats = await pool.query(`
  SELECT DISTINCT category, sub_type, COUNT(*) as count
  FROM accessories 
  WHERE category IS NOT NULL 
  GROUP BY category, sub_type
  ORDER BY category, sub_type
`);
console.log(JSON.stringify(cats.rows, null, 2));

console.log("\n\nTotal accessories:", cats.rows.reduce((sum, r) => sum + parseInt(r.count), 0));

await pool.end();
