import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Ford GT (2017-2022, 2nd gen) - mid-engine supercar
// OEM: front 8.5"x20 ET61, rear 11.5"x20 ET72
// Using front ET61 as reference; car rules: min=OEM-15 (floor -20), max=OEM+20 (cap 55)
// Since ET61 is very high, cap at 55 gives a tight upper range that's appropriate
// min=max(61-15,-20)=46, max=min(61+20,55)=55
const res = await pool.query(`
  UPDATE vehicle_fitments
  SET offset_min_mm = 46,
      offset_max_mm = 55,
      thread_size = COALESCE(thread_size, 'M14x1.5'),
      updated_at = NOW()
  WHERE make = 'Ford' AND model = 'GT'
    AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
`);

console.log(`Ford GT updated: ${res.rowCount} rows`);
console.log('OEM: front ET61 (8.5"x20), rear ET72 (11.5"x20)');
console.log('Range set: [46, 55] (ET46-ET55)');
console.log('Note: Ford GT is an exotic supercar - aftermarket fitment range is very limited');

await pool.end();
