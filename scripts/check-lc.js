const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  const res = await pool.query(`SELECT DISTINCT model FROM vehicle_fitments WHERE make = 'toyota' AND (model LIKE '%land%' OR model LIKE '%cruiser%')`);
  console.log('Toyota land/cruiser models:', res.rows.map(r => r.model));
  
  const lc = await pool.query(`SELECT DISTINCT year FROM vehicle_fitments WHERE make = 'toyota' AND model = 'land cruiser' ORDER BY year`);
  console.log('Land Cruiser (space) years:', lc.rows.map(r => r.year).join(', ') || 'NONE');
  
  const lc2 = await pool.query(`SELECT DISTINCT year FROM vehicle_fitments WHERE make = 'toyota' AND model = 'fj-cruiser' ORDER BY year`);
  console.log('FJ Cruiser years:', lc2.rows.map(r => r.year).join(', ') || 'NONE');
  
  // Check Ford models for Fiesta
  const fiesta = await pool.query(`SELECT DISTINCT model FROM vehicle_fitments WHERE make = 'ford' AND model LIKE '%fiesta%'`);
  console.log('Ford Fiesta models:', fiesta.rows.map(r => r.model) || 'NONE');
  
  await pool.end();
}
check();
