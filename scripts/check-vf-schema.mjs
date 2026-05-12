import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const r = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitment'
`);
console.log('vehicle_fitment columns:');
r.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));

// Also check vehicle_wheel_specs
const ws = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_wheel_specs'
`);
console.log('\nvehicle_wheel_specs columns:');
ws.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));

await pool.end();
