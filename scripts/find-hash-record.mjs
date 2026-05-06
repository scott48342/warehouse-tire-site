import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  SELECT year, make, model, modification_id, display_trim, oem_wheel_sizes, source, certification_status
  FROM vehicle_fitments 
  WHERE modification_id LIKE 'dodge-challenger-hellcat%'
  ORDER BY year DESC, created_at DESC
`);

console.log('Records with dodge-challenger-hellcat mod_id:');
for (const row of result.rows) {
  const wheels = row.oem_wheel_sizes || [];
  console.log('---');
  console.log(`${row.year} ${row.make} ${row.model}`);
  console.log('mod_id:', row.modification_id);
  console.log('display:', row.display_trim);
  console.log('source:', row.source);
  console.log('cert:', row.certification_status);
  console.log('wheels count:', wheels.length);
  console.log('wheels:', JSON.stringify(wheels));
}

if (result.rows.length === 0) {
  console.log('No records found!');
}

await pool.end();
