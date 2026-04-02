require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check vehicle_fitments table for tier-a imports
  const r1 = await client.query(`
    SELECT make, model, display_trim, year, source 
    FROM vehicle_fitments 
    WHERE source = 'tier-a-import' 
    ORDER BY make, model, year DESC
    LIMIT 20
  `);
  console.log('=== Tier-A imports in vehicle_fitments ===');
  console.log(`Found: ${r1.rows.length} records`);
  console.table(r1.rows);

  // Check total counts in vehicle_fitments for Tier A models
  const r2 = await client.query(`
    SELECT make, model, COUNT(*) as count 
    FROM vehicle_fitments 
    WHERE (make = 'Ford' AND model = 'Mustang')
       OR (make = 'Chevrolet' AND model = 'Camaro')
       OR (make = 'Dodge' AND model IN ('Challenger', 'Charger'))
    GROUP BY make, model
    ORDER BY make, model
  `);
  console.log('\n=== Tier A counts in vehicle_fitments ===');
  console.table(r2.rows);

  // Check what tables exist and which ones have Mustang data
  const r3 = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%vehicle%'
  `);
  console.log('\n=== Vehicle-related tables ===');
  console.log(r3.rows.map(r => r.table_name).join(', '));

  await client.end();
}

main().catch(console.error);
