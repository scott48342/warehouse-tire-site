const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  console.log('Deleting batch2 records...');
  
  const result = await pool.query(`
    DELETE FROM vehicle_fitments 
    WHERE source = 'batch2-gap-fill'
    RETURNING year, make, model
  `);
  
  console.log(`Deleted ${result.rowCount} records`);
  
  const total = await pool.query('SELECT COUNT(*) as count FROM vehicle_fitments');
  console.log(`Total records remaining: ${total.rows[0].count}`);
  
  await pool.end();
}

main().catch(console.error);
