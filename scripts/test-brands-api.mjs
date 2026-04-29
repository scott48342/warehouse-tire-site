import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  SELECT DISTINCT brand_desc as brand, COUNT(*) as count 
  FROM wp_wheels 
  WHERE brand_desc IS NOT NULL AND brand_desc != ''
  GROUP BY brand_desc 
  ORDER BY brand_desc
`);

console.log("Total brands:", result.rows.length);
console.log("Sample:", result.rows.slice(0, 10).map(r => r.brand));

await pool.end();
