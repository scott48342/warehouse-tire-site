require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const { rows } = await pool.query(
    "SELECT year, make, model, oem_wheel_sizes FROM vehicle_fitments WHERE year = 1984 AND make = 'Buick' AND model = 'Regal' LIMIT 1"
  );
  console.log('1984 Buick Regal wheel sizes:');
  console.log(JSON.stringify(rows[0], null, 2));
  
  // Check a few more classic cars
  const { rows: classics } = await pool.query(
    "SELECT year, make, model, oem_wheel_sizes FROM vehicle_fitments WHERE year BETWEEN 1980 AND 1989 LIMIT 5"
  );
  console.log('\nSample classic car wheel sizes:');
  classics.forEach(r => console.log(`${r.year} ${r.make} ${r.model}:`, JSON.stringify(r.oem_wheel_sizes)));
  
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
