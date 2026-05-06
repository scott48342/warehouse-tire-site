import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Fetch the exact record the API should be using
const result = await pool.query(`
  SELECT 
    id, 
    modification_id, 
    display_trim, 
    bolt_pattern,
    oem_wheel_sizes,
    certification_status
  FROM vehicle_fitments
  WHERE make = 'Dodge' 
    AND model = 'Challenger' 
    AND year = 2023
    AND modification_id = 'srt-hellcat-widebody'
    AND certification_status = 'certified'
`);

console.log('Direct DB query result:');
console.log('Records found:', result.rows.length);

for (const row of result.rows) {
  console.log('---');
  console.log('ID:', row.id);
  console.log('mod_id:', row.modification_id);
  console.log('display:', row.display_trim);
  console.log('bolt_pattern:', row.bolt_pattern);
  console.log('cert_status:', row.certification_status);
  console.log('oem_wheel_sizes type:', typeof row.oem_wheel_sizes);
  console.log('oem_wheel_sizes isArray:', Array.isArray(row.oem_wheel_sizes));
  console.log('oem_wheel_sizes count:', row.oem_wheel_sizes?.length);
  console.log('oem_wheel_sizes:', JSON.stringify(row.oem_wheel_sizes, null, 2));
}

await pool.end();
