require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const { rows } = await pool.query(
    "SELECT year, make, model, oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE year = 1984 AND make = 'Buick' AND model = 'Regal'"
  );
  console.log('1984 Buick Regal fitment data:');
  rows.forEach(r => {
    console.log(JSON.stringify(r, null, 2));
  });
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
