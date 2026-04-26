import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Count missing data
  const noWheels = await pool.query(`
    SELECT COUNT(*) as c FROM vehicle_fitments 
    WHERE year >= 2000 
    AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]')
  `);
  
  const noTires = await pool.query(`
    SELECT COUNT(*) as c FROM vehicle_fitments 
    WHERE year >= 2000 
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
  `);
  
  console.log('Missing wheel data:', noWheels.rows[0].c);
  console.log('Missing tire data:', noTires.rows[0].c);
  
  // Sample missing
  console.log('\nSample missing wheels:');
  const sampleNoWheels = await pool.query(`
    SELECT year, make, model, submodel, oem_tire_sizes::text as tires
    FROM vehicle_fitments 
    WHERE year >= 2000 AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]')
    LIMIT 10
  `);
  for (const r of sampleNoWheels.rows) {
    console.log(`  ${r.year} ${r.make} ${r.model} [${r.submodel}] - Tires: ${r.tires?.substring(0,50)}`);
  }
  
  console.log('\nSample missing tires:');
  const sampleNoTires = await pool.query(`
    SELECT year, make, model, submodel, oem_wheel_sizes::text as wheels
    FROM vehicle_fitments 
    WHERE year >= 2000 AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    LIMIT 10
  `);
  for (const r of sampleNoTires.rows) {
    console.log(`  ${r.year} ${r.make} ${r.model} [${r.submodel}] - Wheels: ${r.wheels?.substring(0,50)}`);
  }
  
  await pool.end();
}
check();
