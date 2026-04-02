const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check distinct make/model combinations
  const result = await pool.query(`
    SELECT DISTINCT make, model FROM vehicle_fitments 
    WHERE LOWER(make) IN ('kia', 'ford', 'mazda')
    ORDER BY make, model
  `);
  
  console.log('Make/Model combinations:');
  result.rows.forEach(row => console.log(`  ${row.make} / ${row.model}`));
  
  await pool.end();
}

main().catch(console.error);
