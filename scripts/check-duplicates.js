const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Check for models with extra hyphens that might be duplicates
  const r = await pool.query(`
    SELECT DISTINCT model FROM vehicle_fitments 
    WHERE model LIKE '%-%-hd' OR model LIKE '%-%-hd-%'
  `);
  console.log('Models with extra hyphens:', r.rows.length > 0 ? r.rows.map(x => x.model) : 'None');
  
  // Check for engine-style trims
  const e = await pool.query(`
    SELECT DISTINCT display_trim FROM vehicle_fitments 
    WHERE display_trim ~ '^[0-9]+\\.[0-9]+[iL]?$'
  `);
  console.log('Engine-only trims:', e.rows.length > 0 ? e.rows.map(x => x.display_trim) : 'None');
  
  // Final count
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log('\nTotal records:', total.rows[0].count);
  
  await pool.end();
}

check();
