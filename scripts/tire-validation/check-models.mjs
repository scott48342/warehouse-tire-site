import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function check() {
  // Check Tesla models
  let r = await pool.query("SELECT DISTINCT model FROM vehicle_fitments WHERE make = 'tesla' ORDER BY model");
  console.log('Tesla models:', r.rows.map(x => x.model).join(', '));
  
  // Check Jeep models
  r = await pool.query("SELECT DISTINCT model FROM vehicle_fitments WHERE make = 'jeep' ORDER BY model");
  console.log('Jeep models:', r.rows.map(x => x.model).join(', '));
  
  // Check BMW models  
  r = await pool.query("SELECT DISTINCT model FROM vehicle_fitments WHERE make = 'bmw' ORDER BY model");
  console.log('BMW models:', r.rows.map(x => x.model).join(', '));
  
  // Check for grand-cherokee specifically
  r = await pool.query("SELECT DISTINCT model FROM vehicle_fitments WHERE model LIKE '%grand%' OR model LIKE '%cherokee%'");
  console.log('Cherokee variants:', r.rows.map(x => x.model).join(', '));
  
  // Check for 3-series
  r = await pool.query("SELECT DISTINCT model FROM vehicle_fitments WHERE model LIKE '%3%series%' OR model LIKE '%3-series%' OR model = '3-series'");
  console.log('3-series variants:', r.rows.map(x => x.model).join(', '));
  
  await pool.end();
}
check();
