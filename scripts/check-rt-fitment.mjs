import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  console.log('=== 2024 Challenger R/T Full Record ===');
  const r = await pool.query(`
    SELECT 
      modification_id, 
      display_trim,
      bolt_pattern,
      center_bore_mm,
      oem_wheel_sizes,
      oem_tire_sizes,
      certification_status,
      quality_tier,
      source
    FROM vehicle_fitments 
    WHERE make ILIKE 'dodge' 
      AND model ILIKE '%challenger%' 
      AND year = 2024
      AND display_trim = 'R/T'
  `);
  
  if (r.rows.length === 0) {
    console.log('NO RECORD FOUND');
  } else {
    for (const row of r.rows) {
      console.log('\n--- Record ---');
      console.log('modification_id:', row.modification_id);
      console.log('display_trim:', row.display_trim);
      console.log('bolt_pattern:', row.bolt_pattern);
      console.log('center_bore_mm:', row.center_bore_mm);
      console.log('certification_status:', row.certification_status);
      console.log('quality_tier:', row.quality_tier);
      console.log('source:', row.source);
      console.log('oem_wheel_sizes:', JSON.stringify(row.oem_wheel_sizes, null, 2));
      console.log('oem_tire_sizes:', row.oem_tire_sizes);
    }
  }
  
  // Also check the QA vehicle to see what modification ID is being used
  console.log('\n=== QA Test Vehicle for Challenger R/T ===');
  const q2 = await pool.query(`
    SELECT * FROM qa_test_vehicles 
    WHERE make = 'Dodge' AND model = 'Challenger' AND trim = 'R/T'
  `);
  console.log(q2.rows[0]);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
