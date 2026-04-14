const { Pool } = require('pg');
require('dotenv').config({path: '.env.local'});
const pool = new Pool({connectionString: process.env.POSTGRES_URL});

pool.query(`
  SELECT display_trim, tire_size, wheel_diameter, year, make_key, model_key
  FROM vehicle_fitment_configurations 
  WHERE source LIKE '%batch-pipeline%'
  ORDER BY make_key, model_key, year, display_trim
  LIMIT 20
`).then(r => {
  console.log('Sample configs from batch pipeline:');
  r.rows.forEach(c => {
    console.log(`  ${c.year} ${c.make_key} ${c.model_key} - ${c.display_trim}: ${c.tire_size} (${c.wheel_diameter}")`);
  });
  return pool.query(`SELECT COUNT(*) as count FROM vehicle_fitment_configurations WHERE source LIKE '%batch-pipeline%'`);
}).then(r => {
  console.log(`\nTotal batch-pipeline configs: ${r.rows[0].count}`);
  pool.end();
}).catch(err => {
  console.error('Error:', err);
  pool.end();
});
