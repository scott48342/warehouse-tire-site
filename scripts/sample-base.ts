import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function sample() {
  // Sample a few Base records to see their data
  const res = await pool.query(`
    SELECT year, make, model, submodel, bolt_pattern, oem_wheel_sizes::text, oem_tire_sizes::text
    FROM vehicle_fitments 
    WHERE year >= 2020 
      AND (LOWER(submodel) = 'base' OR submodel = '' OR submodel IS NULL)
    LIMIT 15
  `);
  console.log('Sample Base/empty records (2020+):');
  for (const r of res.rows) {
    console.log(`\n${r.year} ${r.make} ${r.model} [${r.submodel || 'NULL'}]`);
    console.log(`  Bolt: ${r.bolt_pattern || 'MISSING'}`);
    console.log(`  Wheels: ${r.oem_wheel_sizes}`);
    console.log(`  Tires: ${r.oem_tire_sizes}`);
  }
  
  // Also check what trim-specific records we DO have
  const withTrims = await pool.query(`
    SELECT DISTINCT make, model, submodel
    FROM vehicle_fitments 
    WHERE year >= 2020 
      AND submodel IS NOT NULL 
      AND LOWER(submodel) NOT IN ('base', '')
    ORDER BY make, model
    LIMIT 30
  `);
  console.log('\n\n=== Records WITH proper trims (2020+): ===');
  for (const r of withTrims.rows) {
    console.log(`  ${r.make} ${r.model} - ${r.submodel}`);
  }
  
  await pool.end();
}
sample();
