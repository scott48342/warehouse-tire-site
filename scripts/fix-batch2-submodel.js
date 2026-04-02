const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  console.log('Fixing batch2 submodel values...');
  
  // Update submodel from "Base" to NULL
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET submodel = NULL
    WHERE source = 'batch2-gap-fill' AND submodel = 'Base'
    RETURNING year, make, model, submodel
  `);
  
  console.log(`Updated ${result.rowCount} records to submodel=NULL`);
  
  // Verify
  const check = await pool.query(`
    SELECT submodel, COUNT(*) as count
    FROM vehicle_fitments 
    WHERE source = 'batch2-gap-fill'
    GROUP BY submodel
  `);
  console.log('\nVerification:', check.rows);
  
  await pool.end();
}

main().catch(console.error);
