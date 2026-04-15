import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const r = await pool.query(`
  SELECT * FROM vehicle_fitment_configurations 
  WHERE year = 2015 AND make_key = 'chrysler' AND model_key = '300'
`);

console.log('Config rows:', r.rows.length);
for (const row of r.rows) {
  console.log('  -', row.display_trim || row.modification_id, ':', row.tire_size, '(', row.wheel_diameter, 'inch)');
}

await pool.end();
