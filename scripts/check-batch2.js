const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  const result = await pool.query(`
    SELECT year, make, model, submodel 
    FROM vehicle_fitments 
    WHERE source = 'batch2-gap-fill' 
    ORDER BY make, model, year
  `);
  
  console.log('Batch 2 records:', result.rowCount);
  console.log('\nSample:');
  console.log(result.rows.slice(0, 10));
  
  // Check coverage audit slug issue - maybe case sensitivity
  const optima = await pool.query(`
    SELECT year, make, model FROM vehicle_fitments 
    WHERE LOWER(make) = 'kia' AND LOWER(model) = 'optima'
    ORDER BY year
  `);
  console.log('\nKia Optima records:', optima.rowCount);
  
  await pool.end();
}

main().catch(console.error);
