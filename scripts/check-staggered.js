const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const sql = (strings, ...values) => {
  const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? '$' + (i + 1) : ''), '');
  return pool.query(text, values).then(r => r.rows);
};

async function check() {
  // Check Camaro SS fitment data
  const camaro = await sql`
    SELECT modification_id, display_trim, bolt_pattern, center_bore_mm,
           oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE year = 2021 AND make ILIKE 'Chevrolet' AND model ILIKE 'Camaro'
    LIMIT 10
  `;
  
  console.log('=== 2021 Camaro Fitments ===');
  for (const row of camaro) {
    console.log(JSON.stringify({
      mod: row.modification_id,
      trim: row.display_trim,
      bolt: row.bolt_pattern,
      wheelSizes: row.oem_wheel_sizes,
      tireSizes: row.oem_tire_sizes
    }, null, 2));
  }
  
  // Check Corvette
  const corvette = await sql`
    SELECT modification_id, display_trim, bolt_pattern, center_bore_mm,
           oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE year >= 2020 AND make ILIKE 'Chevrolet' AND model ILIKE 'Corvette'
    LIMIT 5
  `;
  
  console.log('\n=== Corvette Fitments ===');
  for (const row of corvette) {
    console.log(JSON.stringify({
      mod: row.modification_id,
      trim: row.display_trim,
      bolt: row.bolt_pattern,
      wheelSizes: row.oem_wheel_sizes,
      tireSizes: row.oem_tire_sizes
    }, null, 2));
  }
  
  // Check Mustang GT for comparison (known staggered)
  const mustang = await sql`
    SELECT modification_id, display_trim, bolt_pattern, center_bore_mm,
           oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE year = 2024 AND make ILIKE 'Ford' AND model ILIKE 'Mustang'
    AND (display_trim ILIKE '%GT%' OR display_trim ILIKE '%Dark Horse%')
    LIMIT 5
  `;
  
  console.log('\n=== 2024 Mustang GT/Dark Horse Fitments ===');
  for (const row of mustang) {
    console.log(JSON.stringify({
      mod: row.modification_id,
      trim: row.display_trim,
      bolt: row.bolt_pattern,
      wheelSizes: row.oem_wheel_sizes,
      tireSizes: row.oem_tire_sizes
    }, null, 2));
  }
}

check().catch(console.error);
