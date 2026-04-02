const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  console.log('Fixing batch2 record case...');
  
  // Update make/model to lowercase to match existing format
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET 
      make = LOWER(make),
      model = LOWER(model)
    WHERE source = 'batch2-gap-fill'
    RETURNING year, make, model
  `);
  
  console.log(`Updated ${result.rowCount} records`);
  console.log('Sample:', result.rows.slice(0, 5));
  
  await pool.end();
}

main().catch(console.error);
