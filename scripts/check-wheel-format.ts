import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function check() {
  const { rows } = await pool.query(`
    SELECT year, make, model, oem_wheel_sizes, oem_tire_sizes, bolt_pattern
    FROM vehicle_fitments
    WHERE certification_status = 'certified'
    LIMIT 5
  `);
  
  console.log('Sample certified records:');
  for (const r of rows) {
    console.log(`\n${r.year} ${r.make} ${r.model}:`);
    console.log('  Bolt:', r.bolt_pattern);
    console.log('  Wheels:', JSON.stringify(r.oem_wheel_sizes));
    console.log('  Tires:', JSON.stringify(r.oem_tire_sizes));
    console.log('  Wheel type:', typeof r.oem_wheel_sizes, Array.isArray(r.oem_wheel_sizes) ? 'array' : 'not-array');
    if (Array.isArray(r.oem_wheel_sizes) && r.oem_wheel_sizes.length > 0) {
      console.log('  First wheel item type:', typeof r.oem_wheel_sizes[0]);
      console.log('  First wheel item:', JSON.stringify(r.oem_wheel_sizes[0]));
    }
  }
  
  await pool.end();
}

check().catch(console.error);
