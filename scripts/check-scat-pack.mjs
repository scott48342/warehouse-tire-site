import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  SELECT year, modification_id, display_trim, source, oem_wheel_sizes, certification_status
  FROM vehicle_fitments
  WHERE make = 'Dodge' AND model = 'Challenger'
    AND year IN (2022, 2023)
    AND (display_trim ILIKE '%Scat Pack%' OR display_trim ILIKE '%GT%')
  ORDER BY year DESC, display_trim
`);

console.log('Challenger GT and Scat Pack records (2022-2023):');
for (const row of result.rows) {
  const wheels = row.oem_wheel_sizes || [];
  const fw = wheels.find(w => w.axle === 'front')?.width;
  const rw = wheels.find(w => w.axle === 'rear')?.width;
  console.log(`  ${row.year} ${row.display_trim} (${row.source}) cert=${row.certification_status}`);
  console.log(`    F=${fw}" R=${rw}" [${wheels.length} wheels]`);
}

await pool.end();
