require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  // Check ALL Camaro records
  const r1 = await client.query(`
    SELECT year, make, model, display_trim, modification_id, source 
    FROM vehicle_fitments 
    WHERE LOWER(model) LIKE '%camaro%'
    AND year = 2024
    ORDER BY display_trim
  `);
  console.log('=== ALL 2024 Camaro records (Prisma DB) ===');
  console.log(`Found: ${r1.rows.length} records`);
  console.table(r1.rows);

  // Check what makes exist
  const r2 = await client.query(`
    SELECT DISTINCT make FROM vehicle_fitments WHERE LOWER(make) LIKE '%chev%'
  `);
  console.log('\n=== Chevrolet make values ===');
  console.log(r2.rows);

  // Check exact query the API would use
  const r3 = await client.query(`
    SELECT modification_id, display_trim
    FROM vehicle_fitments
    WHERE year = 2024 AND make = 'chevrolet' AND model = 'camaro'
    ORDER BY display_trim
  `);
  console.log('\n=== API exact match query ===');
  console.log(`Found: ${r3.rows.length} records`);
  console.table(r3.rows);

  await client.end();
}

main().catch(console.error);
