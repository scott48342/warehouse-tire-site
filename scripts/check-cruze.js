const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  const r = await pool.query(
    'SELECT year, display_trim FROM vehicle_fitments WHERE make = $1 AND model = $2 ORDER BY year',
    ['chevrolet', 'cruze']
  );
  
  console.log('Chevy Cruze records:', r.rowCount);
  r.rows.forEach(row => console.log(`  ${row.year}: ${row.display_trim}`));
  
  await pool.end();
}

check();
