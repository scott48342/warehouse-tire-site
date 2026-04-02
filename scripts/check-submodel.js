const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  const result = await pool.query(`
    SELECT submodel, COUNT(*) as count 
    FROM vehicle_fitments 
    WHERE source = 'batch2-gap-fill' 
    GROUP BY submodel
  `);
  
  console.log('Submodel breakdown:');
  console.log(result.rows);
  
  const nullCheck = await pool.query(`
    SELECT COUNT(*) as count 
    FROM vehicle_fitments 
    WHERE source = 'batch2-gap-fill' AND submodel IS NULL
  `);
  console.log('\nNull submodels:', nullCheck.rows[0].count);
  
  await pool.end();
}

main().catch(console.error);
