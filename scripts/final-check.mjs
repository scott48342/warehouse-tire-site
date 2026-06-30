import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const res = await pool.query(`
  SELECT COUNT(*) null_remaining 
  FROM vehicle_fitments 
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL) 
    AND LOWER(make) IN ('ford','lincoln','mercury','jeep','ram','dodge','chrysler','plymouth')
`);
console.log('Remaining nulls for our makes:', res.rows[0].null_remaining);

const total = await pool.query(`
  SELECT COUNT(*) total FROM vehicle_fitments 
  WHERE LOWER(make) IN ('ford','lincoln','mercury','jeep','ram','dodge','chrysler','plymouth')
`);
console.log('Total rows for our makes:', total.rows[0].total);

await pool.end();
