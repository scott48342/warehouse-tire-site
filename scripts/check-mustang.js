require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check vehicle_fitments for 2024 Mustang (case-insensitive)
  const r1 = await client.query(`
    SELECT year, make, model, display_trim, modification_id, source 
    FROM vehicle_fitments 
    WHERE LOWER(make) LIKE '%ford%' AND LOWER(model) LIKE '%mustang%'
    AND year >= 2022
    ORDER BY year DESC, display_trim
  `);
  console.log('=== Mustang in vehicle_fitments (2022+) ===');
  console.log(`Found: ${r1.rows.length} records`);
  console.table(r1.rows.slice(0, 30));

  // Check normalization - what make values exist?
  const r2 = await client.query(`
    SELECT DISTINCT make FROM vehicle_fitments WHERE LOWER(make) LIKE '%ford%'
  `);
  console.log('\n=== Ford make values ===');
  console.log(r2.rows);

  // Check Camaro too
  const r3 = await client.query(`
    SELECT year, make, model, display_trim, modification_id
    FROM vehicle_fitments 
    WHERE LOWER(make) LIKE '%chevrolet%' AND LOWER(model) LIKE '%camaro%'
    AND year = 2024
    LIMIT 15
  `);
  console.log('\n=== 2024 Camaro in vehicle_fitments ===');
  console.table(r3.rows);

  await client.end();
}

main().catch(console.error);
