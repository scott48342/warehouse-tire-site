const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  const result = await pool.query(`
    SELECT *
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'focus' AND year = 2005
  `);
  
  console.log('2005 Ford Focus record:');
  console.log(JSON.stringify(result.rows[0], null, 2));
  
  await pool.end();
}

main().catch(console.error);
