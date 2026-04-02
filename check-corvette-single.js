const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  const single = await pool.query(`
    SELECT year, array_agg(display_trim) as trims
    FROM vehicle_fitments 
    WHERE make = 'chevrolet' AND model = 'corvette'
    GROUP BY year 
    HAVING COUNT(*) = 1
    ORDER BY year
  `);
  
  console.log('Corvette single-trim years:');
  for (const r of single.rows) {
    console.log(`  ${r.year}: ${r.trims}`);
  }
  
  await pool.end();
}
main();
