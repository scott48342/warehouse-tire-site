const { Pool } = require('pg');
require('dotenv').config({path: '.env.local'});
const pool = new Pool({connectionString: process.env.POSTGRES_URL});

pool.query(`SELECT source, COUNT(*) as count FROM vehicle_fitment_configurations WHERE source LIKE '%batch%' OR source LIKE '%tiresize%' GROUP BY source ORDER BY source`)
  .then(r => {
    console.log('Configs by source:');
    let total = 0;
    r.rows.forEach(row => {
      console.log(`  ${row.source}: ${row.count}`);
      total += parseInt(row.count);
    });
    console.log(`\n  TOTAL: ${total}`);
    pool.end();
  })
  .catch(err => {
    console.error('Error:', err);
    pool.end();
  });
