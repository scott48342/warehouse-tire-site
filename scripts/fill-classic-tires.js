const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function fill() {
  console.log('🛞 FILLING CLASSIC CAR TIRES\n');

  // Classic Chevy tire sizes by era
  // 1960s-70s muscle cars typically ran 14" or 15" wheels
  const classicChevyTires = ['F70-14', 'G70-14', 'G70-15', 'F60-15', 'G60-15', 'L60-15', '225/70R14', '235/70R15', '245/60R15', '255/60R15', '275/60R15'];

  // Chevelle
  let result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $1::jsonb
    WHERE make = 'chevrolet' AND model = 'chevelle'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
    RETURNING id
  `, [JSON.stringify(classicChevyTires)]);
  console.log(`✅ Chevelle: ${result.rowCount} records filled`);

  // Nova
  result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $1::jsonb
    WHERE make = 'chevrolet' AND model = 'nova'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
    RETURNING id
  `, [JSON.stringify(classicChevyTires)]);
  console.log(`✅ Nova: ${result.rowCount} records filled`);

  // Datsun Z-cars (14" wheels stock)
  const datsunTires = ['175/70R14', '185/70R14', '195/70R14', '205/60R14', '195/60R15', '205/55R16'];
  
  result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $1::jsonb, 
        oem_wheel_sizes = $2::jsonb
    WHERE make = 'datsun'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
    RETURNING id
  `, [JSON.stringify(datsunTires), JSON.stringify(['14x5.5', '14x6', '15x6', '15x7'])]);
  console.log(`✅ Datsun: ${result.rowCount} records filled`);

  // Eagle vehicles (1988-1998) - FWD/AWD platforms
  const eagleTires = ['185/70R14', '195/70R14', '205/60R15', '215/60R15', '205/55R16'];
  
  result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $1::jsonb,
        oem_wheel_sizes = $2::jsonb
    WHERE make = 'eagle'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
    RETURNING id
  `, [JSON.stringify(eagleTires), JSON.stringify(['14x6', '15x6', '16x6.5'])]);
  console.log(`✅ Eagle: ${result.rowCount} records filled`);

  // Jeep Liberty 2003 (16" or 17" wheels)
  const libertyTires = ['215/75R16', '225/75R16', '235/70R16', '235/65R17', '245/65R17'];
  
  result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $1::jsonb,
        oem_wheel_sizes = $2::jsonb
    WHERE make = 'jeep' AND model = 'liberty'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
    RETURNING id
  `, [JSON.stringify(libertyTires), JSON.stringify(['16x7', '17x7'])]);
  console.log(`✅ Jeep Liberty: ${result.rowCount} records filled`);

  // Final check
  const remaining = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb
  `);
  
  console.log(`\n📊 Remaining without tire data: ${remaining.rows[0].cnt}`);

  await pool.end();
}

fill().catch(e => { console.error(e); process.exit(1); });
