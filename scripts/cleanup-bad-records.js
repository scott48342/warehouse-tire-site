const { Pool } = require('pg');
const pool = new Pool({connectionString: process.env.POSTGRES_URL});

pool.query(`DELETE FROM vehicle_fitment_configurations WHERE source LIKE '%batch-pipeline%'`)
  .then(r => {
    console.log('Deleted bad batch-pipeline records:', r.rowCount);
    pool.end();
  })
  .catch(err => {
    console.error('Error:', err);
    pool.end();
  });
