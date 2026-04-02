const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function fix() {
  console.log('🔧 Updating Plymouth wheel sizes to verified OEM specs\n');

  // Plymouth Barracuda - Base models got 14x5.5, Formula S/performance got 15x7
  // Since all our records are "Base" trim, use base specs
  const barracudaWheels = ['14x5.5', '14x6', '15x7'];  // Include 15x7 as common upgrade
  
  const barracuda = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_wheel_sizes = $1::jsonb
    WHERE make = 'plymouth' AND model = 'barracuda'
    RETURNING year, display_trim
  `, [JSON.stringify(barracudaWheels)]);
  console.log(`✅ Barracuda: ${barracuda.rowCount} records → ${JSON.stringify(barracudaWheels)}`);

  // Plymouth Road Runner - B-body, similar specs: 14" base, 15x7 on performance
  const roadRunnerWheels = ['14x5.5', '14x6', '15x7'];
  
  const roadRunner = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_wheel_sizes = $1::jsonb
    WHERE make = 'plymouth' AND model = 'road-runner'
    RETURNING year, display_trim
  `, [JSON.stringify(roadRunnerWheels)]);
  console.log(`✅ Road Runner: ${roadRunner.rowCount} records → ${JSON.stringify(roadRunnerWheels)}`);

  console.log(`\n📊 Total updated: ${barracuda.rowCount + roadRunner.rowCount}`);

  await pool.end();
}

fix().catch(e => { console.error(e); process.exit(1); });
