const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Check all Jeep models in DB
  console.log('All Jeep models in DB:');
  const models = await pool.query(`
    SELECT DISTINCT model, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'jeep'
    GROUP BY model
    ORDER BY model
  `);
  for (const r of models.rows) {
    console.log(`  ${r.model}: ${r.cnt} records`);
  }

  // Check Wrangler specifically
  console.log('\nWrangler records:');
  const wrangler = await pool.query(`
    SELECT year, display_trim FROM vehicle_fitments
    WHERE make = 'jeep' AND model = 'wrangler'
    ORDER BY year DESC
    LIMIT 10
  `);
  for (const r of wrangler.rows) {
    console.log(`  ${r.year}: ${r.display_trim}`);
  }

  // Check models API would return
  console.log('\nModels for 2024 Jeep (simulated API):');
  const api = await pool.query(`
    SELECT DISTINCT model FROM vehicle_fitments
    WHERE make = 'jeep' AND year = 2024
    ORDER BY model
  `);
  for (const r of api.rows) {
    console.log(`  ${r.model}`);
  }

  await pool.end();
}
main();
