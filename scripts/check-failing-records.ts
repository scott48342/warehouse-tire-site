import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check records that QA flagged
  const failing = await pool.query(`
    SELECT year, make, model, submodel, 
           oem_wheel_sizes::text as wheels,
           oem_tire_sizes::text as tires
    FROM vehicle_fitments 
    WHERE (make = 'Kia' AND model = 'sorento' AND year = 2005)
       OR (make = 'Cadillac' AND model = 'cts' AND year = 2009)
       OR (make = 'Mercedes-Benz' AND model LIKE '%E-Class%' AND year = 2012)
       OR (make = 'Jeep' AND model = 'grand-cherokee' AND year = 2011)
       OR (make = 'RAM' AND model = '1500' AND year = 2018)
  `);
  
  console.log('Failing records:\n');
  for (const r of failing.rows) {
    console.log(`${r.year} ${r.make} ${r.model} [${r.submodel}]`);
    console.log(`  Wheels: ${r.wheels}`);
    console.log(`  Tires: ${r.tires}`);
    console.log('');
  }
  
  // Count records with null/empty diameter in wheel array
  console.log('\nChecking wheel diameter issues...');
  const badWheels = await pool.query(`
    SELECT COUNT(*) as c 
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes::text != '[]'
      AND (oem_wheel_sizes::text NOT LIKE '%diameter%' OR oem_wheel_sizes::text LIKE '%"diameter":null%')
  `);
  console.log(`Records with missing/null diameter: ${badWheels.rows[0].c}`);
  
  // Sample bad wheel records
  const sampleBad = await pool.query(`
    SELECT year, make, model, oem_wheel_sizes::text as wheels
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes::text != '[]'
      AND oem_wheel_sizes::text NOT LIKE '%diameter%'
    LIMIT 5
  `);
  console.log('\nSample records without diameter field:');
  for (const r of sampleBad.rows) {
    console.log(`  ${r.year} ${r.make} ${r.model}: ${r.wheels.substring(0,100)}`);
  }
  
  await pool.end();
}
check();
