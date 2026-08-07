require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const { rows } = await pool.query(`
    SELECT make, model, rec_wheel_diameter_min, rec_wheel_diameter_max, rec_wheel_width_min, rec_wheel_width_max
    FROM classic_fitments 
    WHERE platform_code = 'G-BODY'
  `);
  
  console.log('G-BODY classic_fitments:');
  rows.forEach(r => console.log(`  ${r.make} ${r.model}: diameter ${r.rec_wheel_diameter_min}-${r.rec_wheel_diameter_max}, width ${r.rec_wheel_width_min}-${r.rec_wheel_width_max}`));
  
  await pool.end();
}
check();
