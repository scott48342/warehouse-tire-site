import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check how many records per year/make/model
  const res = await pool.query(`
    SELECT year, make, model, COUNT(*) as record_count
    FROM vehicle_fitments 
    WHERE year >= 2020
      AND (LOWER(submodel) = 'base' OR submodel = '' OR submodel IS NULL)
    GROUP BY year, make, model
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `);
  
  console.log('Vehicles with MULTIPLE Base/NULL records (2020+):\n');
  for (const r of res.rows) {
    console.log(`${r.year} ${r.make} ${r.model}: ${r.record_count} records`);
  }
  
  // Let's look at one specific vehicle's records
  console.log('\n\n=== Example: 2024 Ford F-150 records ===\n');
  const f150 = await pool.query(`
    SELECT id, submodel, bolt_pattern, oem_wheel_sizes::text, oem_tire_sizes::text
    FROM vehicle_fitments 
    WHERE year = 2024 AND make = 'Ford' AND LOWER(model) LIKE '%f-150%' OR LOWER(model) LIKE '%f150%'
    ORDER BY id
  `);
  
  for (const r of f150.rows) {
    console.log(`ID ${r.id}: [${r.submodel || 'NULL'}]`);
    console.log(`  Bolt: ${r.bolt_pattern}`);
    console.log(`  Wheels: ${r.oem_wheel_sizes?.substring(0, 80)}...`);
    console.log(`  Tires: ${r.oem_tire_sizes?.substring(0, 80)}...`);
    console.log('');
  }
  
  await pool.end();
}
check();
