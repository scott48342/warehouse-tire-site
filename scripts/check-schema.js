const { Pool } = require('pg');
const pool = new Pool({connectionString: process.env.POSTGRES_URL});

pool.query(`
  SELECT column_name, is_nullable, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitment_configurations' 
  ORDER BY ordinal_position
`).then(r => {
  console.log('Schema for vehicle_fitment_configurations:');
  r.rows.forEach(c => {
    console.log('  ' + c.column_name + ': ' + c.data_type + ' (' + (c.is_nullable === 'YES' ? 'nullable' : 'NOT NULL') + ')');
  });
  pool.end();
}).catch(err => {
  console.error(err);
  pool.end();
});
