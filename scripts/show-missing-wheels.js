const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

pool.query(`
  SELECT year, make, model, display_trim 
  FROM vehicle_fitments 
  WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb 
  ORDER BY make, model, year
`).then(r => {
  r.rows.forEach(x => console.log(`${x.year} ${x.make} ${x.model} ${x.display_trim}`));
  console.log(`\nTotal: ${r.rows.length}`);
  pool.end();
});
