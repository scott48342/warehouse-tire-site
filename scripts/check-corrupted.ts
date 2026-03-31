import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const result = await pool.query(
    `SELECT year, make, model, display_trim, oem_wheel_sizes 
     FROM vehicle_fitments 
     WHERE (year = 2013 AND make = 'dodge' AND model = 'avenger')
        OR (year = 1999 AND make = 'nissan' AND model = 'maxima')
        OR (year = 2026 AND make = 'rivian' AND model = 'r1s')
     LIMIT 5`
  );
  for (const row of result.rows) {
    console.log(`${row.year} ${row.make} ${row.model}:`);
    console.log('  Type:', typeof row.oem_wheel_sizes);
    console.log('  Value:', JSON.stringify(row.oem_wheel_sizes, null, 2));
  }
  await pool.end();
}
check();
