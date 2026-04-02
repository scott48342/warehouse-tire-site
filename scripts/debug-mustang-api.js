require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check ALL 2024 Mustang records with ALL fields
  const r1 = await client.query(`
    SELECT * FROM vehicle_fitments 
    WHERE year = 2024 AND LOWER(make) = 'ford' AND LOWER(model) = 'mustang'
  `);
  console.log('=== ALL 2024 Mustang records ===');
  console.log(`Found: ${r1.rows.length} records`);
  if (r1.rows.length > 0) {
    console.log('Fields:', Object.keys(r1.rows[0]));
    console.table(r1.rows.map(r => ({
      id: r.id,
      make: r.make,
      model: r.model,
      display_trim: r.display_trim,
      modification_id: r.modification_id,
      source: r.source
    })));
  }

  // Check 2022 for comparison
  const r2 = await client.query(`
    SELECT id, make, model, display_trim, modification_id, source 
    FROM vehicle_fitments 
    WHERE year = 2022 AND LOWER(make) = 'ford' AND LOWER(model) = 'mustang'
  `);
  console.log('\n=== ALL 2022 Mustang records ===');
  console.log(`Found: ${r2.rows.length} records`);
  console.table(r2.rows);

  // Now test directly what the API query would see
  // The coverage.ts uses: eq(vehicleFitments.make, normalizedMake)
  // where normalizedMake = normalizeMake('Ford') = 'ford'
  const r3 = await client.query(`
    SELECT modification_id, display_trim
    FROM vehicle_fitments
    WHERE year = 2024 AND make = 'ford' AND model = 'mustang'
    ORDER BY display_trim
  `);
  console.log('\n=== What API query sees (exact match) ===');
  console.log(`Found: ${r3.rows.length} records`);
  console.table(r3.rows);

  await client.end();
}

main().catch(console.error);
