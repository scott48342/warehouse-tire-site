const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function fill() {
  // Plymouth Barracuda (A-body 64-69, E-body 70-74) - 14" and 15" wheels
  // Plymouth Road Runner (B-body) - 14" and 15" wheels
  const moparWheels = ['14x6', '14x7', '15x6', '15x7'];

  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_wheel_sizes = $1::jsonb
    WHERE make = 'plymouth'
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb)
    RETURNING year, model, display_trim
  `, [JSON.stringify(moparWheels)]);

  console.log(`✅ Plymouth: ${result.rowCount} records filled with wheel sizes`);
  result.rows.forEach(r => console.log(`   ${r.year} ${r.model} ${r.display_trim}`));

  // Verify
  const remaining = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb
  `);
  console.log(`\n📊 Remaining without wheel data: ${remaining.rows[0].cnt}`);

  await pool.end();
}

fill().catch(e => { console.error(e); process.exit(1); });
