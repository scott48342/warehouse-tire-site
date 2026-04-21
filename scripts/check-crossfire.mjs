import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const { rows } = await pool.query(`
  SELECT * FROM vehicle_fitments 
  WHERE LOWER(make) = 'chrysler' 
  AND LOWER(model) LIKE '%crossfire%'
  ORDER BY year
`);

console.log(JSON.stringify(rows, null, 2));
await pool.end();
