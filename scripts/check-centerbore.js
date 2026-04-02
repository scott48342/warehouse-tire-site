const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // 2008 Chrysler 300
  const chrysler = await pool.query(`
    SELECT display_trim, center_bore_mm, bolt_pattern 
    FROM vehicle_fitments 
    WHERE year = 2008 AND LOWER(make) = 'chrysler' AND LOWER(model) = '300'
    ORDER BY display_trim
  `);
  
  console.log('=== 2008 Chrysler 300 ===');
  chrysler.rows.forEach(r => console.log(`${r.display_trim} | cb: ${r.center_bore_mm} | bolt: ${r.bolt_pattern}`));

  // 2015 Ford F-250
  const f250 = await pool.query(`
    SELECT display_trim, center_bore_mm, bolt_pattern 
    FROM vehicle_fitments 
    WHERE year = 2015 AND LOWER(make) = 'ford' AND LOWER(model) = 'f-250'
    ORDER BY display_trim
  `);
  
  console.log('\n=== 2015 Ford F-250 ===');
  f250.rows.forEach(r => console.log(`${r.display_trim} | cb: ${r.center_bore_mm} | bolt: ${r.bolt_pattern}`));

  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
