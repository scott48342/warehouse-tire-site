const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  
  // Check catalog tables
  const makes = await client.query('SELECT COUNT(*) as cnt FROM catalog_makes');
  const models = await client.query('SELECT COUNT(*) as cnt FROM catalog_models');
  const fitments = await client.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
  
  console.log('CATALOG DATA:');
  console.log('catalog_makes:', makes.rows[0].cnt);
  console.log('catalog_models:', models.rows[0].cnt);
  console.log('vehicle_fitments:', fitments.rows[0].cnt);
  
  // Sample high-value vehicles from catalog
  const catMakes = await client.query('SELECT slug, name FROM catalog_makes ORDER BY name LIMIT 30');
  console.log('\nCatalog makes:', catMakes.rows.map(r => r.name).join(', '));
  
  // Check specific vehicles
  const ford = await client.query("SELECT name, years FROM catalog_models WHERE make_slug = 'ford' ORDER BY name");
  console.log('\nFord models in catalog:', ford.rows.map(r => `${r.name} (${r.years?.length || 0} years)`).join(', '));
  
  const chevy = await client.query("SELECT name, years FROM catalog_models WHERE make_slug = 'chevrolet' ORDER BY name");
  console.log('\nChevrolet models in catalog:', chevy.rows.map(r => `${r.name} (${r.years?.length || 0} years)`).join(', '));
  
  const toyota = await client.query("SELECT name, years FROM catalog_models WHERE make_slug = 'toyota' ORDER BY name");
  console.log('\nToyota models in catalog:', toyota.rows.map(r => `${r.name} (${r.years?.length || 0} years)`).join(', '));
  
  client.release();
  await pool.end();
})().catch(console.error);
