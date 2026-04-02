const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Check all Silverado 2500 variants
  const r = await pool.query(`
    SELECT year, model, display_trim 
    FROM vehicle_fitments 
    WHERE make = 'chevrolet' AND model LIKE '%2500%'
    ORDER BY model, year
  `);
  
  console.log('Chevy 2500 variants:', r.rowCount, 'records\n');
  
  let currentModel = '';
  r.rows.forEach(row => {
    if (row.model !== currentModel) {
      currentModel = row.model;
      console.log(`\n${row.model}:`);
    }
    console.log(`  ${row.year}: ${row.display_trim}`);
  });
  
  await pool.end();
}

check();
