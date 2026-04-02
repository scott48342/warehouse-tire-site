const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check how F-150 (multi-trim vehicle) is structured
  const f150 = await pool.query(`
    SELECT year, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'f-150' AND year = 2020
    ORDER BY display_trim
  `);
  
  console.log('F-150 2020 structure (multi-trim truck):');
  f150.rows.forEach(r => {
    console.log(`  ${r.display_trim}: tires=${JSON.stringify(r.oem_tire_sizes)}, wheels=${JSON.stringify(r.oem_wheel_sizes)}`);
  });
  
  // Check Toyota Camry
  const camry = await pool.query(`
    SELECT year, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'camry' AND year = 2020
    ORDER BY display_trim
  `);
  
  console.log('\nCamry 2020 structure:');
  camry.rows.forEach(r => {
    console.log(`  ${r.display_trim}: tires=${JSON.stringify(r.oem_tire_sizes)}, wheels=${JSON.stringify(r.oem_wheel_sizes)}`);
  });
  
  // Check Honda Civic
  const civic = await pool.query(`
    SELECT year, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'honda' AND LOWER(model) = 'civic' AND year = 2020
    ORDER BY display_trim
  `);
  
  console.log('\nCivic 2020 structure:');
  civic.rows.forEach(r => {
    console.log(`  ${r.display_trim}: tires=${JSON.stringify(r.oem_tire_sizes)}, wheels=${JSON.stringify(r.oem_wheel_sizes)}`);
  });
  
  await pool.end();
}

main().catch(console.error);
