const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fix() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const r = await pool.query(
    `UPDATE vehicle_fitments SET model = 'mx-5-miata' WHERE model = 'mx-5 miata' RETURNING id`
  );
  console.log('Updated:', r.rowCount);
  
  // Verify no spaces left
  const check = await pool.query(`
    SELECT DISTINCT model FROM vehicle_fitments WHERE model LIKE '% %'
  `);
  if (check.rows.length === 0) {
    console.log('✅ No models with spaces remaining!');
  } else {
    console.log('Remaining:', check.rows.map(r => r.model));
  }
  
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log('Total records:', total.rows[0].count);
  
  await pool.end();
}

fix();
