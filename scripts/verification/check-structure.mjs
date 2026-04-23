import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();
const result = await client.query(`
  SELECT year, oem_wheel_sizes, oem_tire_sizes
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'bmw' 
  AND (LOWER(model) = '5-series' OR LOWER(model) = '5 series')
  AND year = 1985
  LIMIT 2
`);
console.log('Sample data structure:');
console.log(JSON.stringify(result.rows, null, 2));
console.log('\nType of oem_wheel_sizes:', typeof result.rows[0]?.oem_wheel_sizes);
console.log('Type of first wheel:', typeof result.rows[0]?.oem_wheel_sizes?.[0]);

client.release();
await pool.end();
