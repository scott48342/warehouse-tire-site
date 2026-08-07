require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check what vehicle_fitments has for 1984 Buick Regal
  const { rows } = await pool.query(`
    SELECT year, make, model, oem_wheel_sizes, bolt_pattern, center_bore_mm
    FROM vehicle_fitments 
    WHERE year = 1984 AND make = 'Buick' AND LOWER(model) LIKE '%regal%'
  `);
  
  console.log('vehicle_fitments for 1984 Buick Regal:');
  rows.forEach(r => {
    console.log(`  ${r.year} ${r.make} ${r.model}`);
    console.log(`    bolt: ${r.bolt_pattern}, hub: ${r.center_bore_mm}mm`);
    console.log(`    oem_wheel_sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
  });
  
  // Extract diameters from oem_wheel_sizes
  if (rows[0]?.oem_wheel_sizes) {
    const sizes = rows[0].oem_wheel_sizes;
    if (Array.isArray(sizes)) {
      const diameters = sizes.map(s => s.diameter || s.rim_diameter || s).filter(Boolean);
      console.log(`\n  Extracted diameters: ${diameters.join(', ')}`);
    }
  }
  
  await pool.end();
}
check();
