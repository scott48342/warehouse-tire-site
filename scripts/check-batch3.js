const { Pool } = require('pg');
require('dotenv').config({path: '.env.local'});
const pool = new Pool({connectionString: process.env.POSTGRES_URL});

// Check batch3-targeted source
pool.query(`
  SELECT COUNT(*) as count FROM vehicle_fitment_configurations 
  WHERE source LIKE '%batch3-targeted%'
`).then(r => {
  console.log('Batch 3 configs:', r.rows[0].count);
  return pool.query(`SELECT COUNT(*) as count FROM vehicle_fitment_configurations WHERE source LIKE '%batch-pipeline%' OR source LIKE '%batch3%'`);
}).then(r => {
  console.log('Total all batches:', r.rows[0].count);
  return pool.query(`SELECT source, COUNT(*) as count FROM vehicle_fitment_configurations WHERE source LIKE '%batch%' GROUP BY source`);
}).then(r => {
  console.log('\nBy source:');
  r.rows.forEach(row => console.log(`  ${row.source}: ${row.count}`));
  pool.end();
}).catch(err => {
  console.error('Error:', err);
  pool.end();
});
