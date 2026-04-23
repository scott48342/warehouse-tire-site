import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();
const r = await client.query(`
  SELECT oem_wheel_sizes, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE year = 1980 AND LOWER(model) = 'suburban' 
  LIMIT 1
`);
console.log('wheel_sizes type:', typeof r.rows[0]?.oem_wheel_sizes);
console.log('wheel_sizes:', JSON.stringify(r.rows[0]?.oem_wheel_sizes, null, 2));
console.log('tire_sizes:', JSON.stringify(r.rows[0]?.oem_tire_sizes, null, 2));
client.release();
await pool.end();
