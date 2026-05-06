import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check what records exist for 2023 Challenger Hellcat variants
const result = await pool.query(`
  SELECT id, modification_id, display_trim, oem_wheel_sizes, source
  FROM vehicle_fitments
  WHERE make = 'Dodge' AND model = 'Challenger' AND year = 2023
  ORDER BY display_trim
`);

console.log('2023 Dodge Challenger records:', result.rows.length);
for (const row of result.rows) {
  const wheels = row.oem_wheel_sizes || [];
  const frontWidth = wheels.find(w => w.axle === 'front')?.width;
  const rearWidth = wheels.find(w => w.axle === 'rear')?.width;
  console.log(`  ${row.modification_id} (${row.display_trim})`);
  console.log(`    source: ${row.source}`);
  console.log(`    wheels: F=${frontWidth}" R=${rearWidth}"`);
  console.log(`    raw: ${JSON.stringify(wheels)}`);
}

await pool.end();
