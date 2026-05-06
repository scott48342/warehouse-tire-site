import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  SELECT modification_id, display_trim, oem_wheel_sizes, source, created_at, certification_status
  FROM vehicle_fitments 
  WHERE make = 'Dodge' AND model = 'Challenger' AND year = 2023
  AND (modification_id ILIKE '%hellcat%' OR display_trim ILIKE '%hellcat%')
  ORDER BY created_at DESC
`);

console.log('All Hellcat records for 2023 Challenger:');
for (const row of result.rows) {
  const wheels = row.oem_wheel_sizes || [];
  const widths = wheels.map(w => w.width);
  console.log('---');
  console.log('mod_id:', row.modification_id);
  console.log('display:', row.display_trim);
  console.log('source:', row.source);
  console.log('cert:', row.certification_status);
  console.log('created:', row.created_at);
  console.log('wheels:', widths.join(', '));
}

await pool.end();
