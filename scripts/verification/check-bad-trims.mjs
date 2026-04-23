import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();
const r = await client.query(`
  SELECT year, display_trim, COUNT(*)::int as count 
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'suburban' 
  AND display_trim LIKE '%Premier%'
  GROUP BY year, display_trim 
  ORDER BY year
`);
console.table(r.rows);

// Also check modern Suburban years  
const modern = await client.query(`
  SELECT year, display_trim, bolt_pattern
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'suburban' 
  AND year >= 2015
  ORDER BY year, display_trim
`);
console.log('\n=== Modern Suburban (2015+) ===');
console.table(modern.rows);

client.release();
await pool.end();
