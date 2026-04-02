const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  const result = await pool.query(`
    SELECT display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE make = 'ford' AND model = 'focus' AND year = 2005
    ORDER BY display_trim
  `);
  
  console.log('2005 Ford Focus trims:');
  result.rows.forEach(r => {
    console.log(`  ${r.display_trim}:`);
    console.log(`    Tires: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`    Wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
  });
  
  await pool.end();
}

main().catch(console.error);
