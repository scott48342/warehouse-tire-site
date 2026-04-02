const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check Mustang
  const mustang = await pool.query(`
    SELECT year, display_trim, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make = 'ford' AND model = 'mustang' AND year BETWEEN 2000 AND 2009
    ORDER BY year, display_trim
  `);
  console.log('Ford Mustang (2000-2009):');
  mustang.rows.forEach(r => console.log(`  ${r.year} ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)}`));
  
  // Check Camaro (especially staggered SS)
  const camaro = await pool.query(`
    SELECT year, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make = 'chevrolet' AND model = 'camaro' AND year = 2012
    ORDER BY display_trim
  `);
  console.log('\n2012 Camaro (check staggered SS):');
  camaro.rows.forEach(r => {
    console.log(`  ${r.display_trim}:`);
    console.log(`    Wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log(`    Tires: ${JSON.stringify(r.oem_tire_sizes)}`);
  });
  
  // Check Jeep
  const jeep = await pool.query(`
    SELECT year, display_trim, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make = 'jeep' AND model = 'cherokee' AND year IN (2000, 2001)
    ORDER BY year, display_trim
  `);
  console.log('\nJeep Cherokee XJ (2000-2001):');
  jeep.rows.forEach(r => console.log(`  ${r.year} ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)}`));
  
  await pool.end();
}

main().catch(console.error);
