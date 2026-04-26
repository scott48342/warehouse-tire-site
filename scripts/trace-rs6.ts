import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function trace() {
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim,
           oem_wheel_sizes, oem_tire_sizes,
           audit_original_data, certification_status
    FROM vehicle_fitments
    WHERE make = 'Audi' AND model = 'rs6'
    ORDER BY year
  `);
  
  console.log('=== AUDI RS6 FULL TRACE ===');
  console.log('Records found:', result.rows.length);
  
  for (const r of result.rows) {
    console.log('\n' + '='.repeat(50));
    console.log(`${r.year} ${r.make} ${r.model} "${r.raw_trim}"`);
    console.log('Status:', r.certification_status);
    console.log('Current wheels:', JSON.stringify(r.oem_wheel_sizes, null, 2));
    console.log('Current tires:', JSON.stringify(r.oem_tire_sizes));
    
    if (r.audit_original_data) {
      console.log('\nORIGINAL DATA (before correction):');
      const orig = r.audit_original_data;
      console.log('  Original wheels:', JSON.stringify(orig.original_wheels, null, 2));
      console.log('  Original tires:', JSON.stringify(orig.original_tires));
      console.log('  Captured at:', orig.captured_at);
    }
  }
  
  await pool.end();
}

trace().catch(console.error);
