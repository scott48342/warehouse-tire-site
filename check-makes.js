const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Check F-250/F-350
  const f250 = await pool.query(`SELECT DISTINCT make, model, year FROM vehicle_fitments WHERE model IN ('F-250', 'F-350') ORDER BY model, year DESC LIMIT 30`);
  console.log('F-250/F-350 records:');
  console.log(f250.rows);
  
  // Check Mercedes
  const merc = await pool.query(`SELECT DISTINCT make, model FROM vehicle_fitments WHERE LOWER(make) LIKE '%merc%'`);
  console.log('\nMercedes makes:');
  console.log(merc.rows);
  
  // Check what selectors return vs database
  const selMakes = await pool.query(`SELECT DISTINCT make FROM vehicle_fitments WHERE make IN ('Ford', 'FORD', 'Mercedes', 'MERCEDES', 'Mercedes-Benz', 'BMW', 'Chevrolet')`);
  console.log('\nMakes in DB:');
  console.log(selMakes.rows);
  
  await pool.end();
}

main().catch(console.error);
