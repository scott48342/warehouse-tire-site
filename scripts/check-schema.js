const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments' 
    ORDER BY ordinal_position
  `);
  console.log('Columns:');
  res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  await pool.end();
}
check();
