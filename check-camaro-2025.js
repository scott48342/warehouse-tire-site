const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  const res = await pool.query(`
    SELECT year, display_trim 
    FROM vehicle_fitments 
    WHERE make = 'chevrolet' AND model = 'camaro' AND year >= 2025
    ORDER BY year, display_trim
  `);
  
  console.log('Camaro 2025+:');
  for (const r of res.rows) {
    console.log(`  ${r.year}: ${r.display_trim}`);
  }
  
  await pool.end();
}
main();
