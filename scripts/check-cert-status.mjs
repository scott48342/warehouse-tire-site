import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check certification_status for our Challenger records
const result = await pool.query(`
  SELECT modification_id, display_trim, certification_status, oem_wheel_sizes
  FROM vehicle_fitments
  WHERE make = 'Dodge' AND model = 'Challenger' AND year = 2023
  AND modification_id ILIKE '%hellcat%widebody%'
`);

console.log('Certification status for 2023 Challenger Hellcat Widebody variants:');
for (const row of result.rows) {
  const wheels = row.oem_wheel_sizes || [];
  console.log(`\n  mod_id: ${row.modification_id}`);
  console.log(`  display: ${row.display_trim}`);
  console.log(`  status: ${row.certification_status || 'NULL'}`);
  console.log(`  wheels: ${wheels.length} entries`);
  for (const w of wheels) {
    console.log(`    - axle=${w.axle} dia=${w.diameter} width=${w.width}`);
  }
}

await pool.end();
