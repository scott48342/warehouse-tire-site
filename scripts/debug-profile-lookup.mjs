import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check ALL records for 2023 Dodge Challenger that might match "SRT Hellcat Widebody"
const result = await pool.query(`
  SELECT id, modification_id, display_trim, oem_wheel_sizes, source, created_at, updated_at
  FROM vehicle_fitments
  WHERE make = 'Dodge' AND model = 'Challenger' AND year = 2023
  AND (
    modification_id ILIKE '%hellcat%' OR 
    display_trim ILIKE '%hellcat%'
  )
  ORDER BY created_at DESC
`);

console.log('All 2023 Challenger Hellcat records:');
for (const row of result.rows) {
  const wheels = row.oem_wheel_sizes || [];
  const frontWidth = wheels.find(w => w.axle === 'front')?.width;
  const rearWidth = wheels.find(w => w.axle === 'rear')?.width;
  console.log(`\n  ID: ${row.id.slice(0, 8)}...`);
  console.log(`  mod_id: "${row.modification_id}"`);
  console.log(`  display: "${row.display_trim}"`);
  console.log(`  source: ${row.source}`);
  console.log(`  created: ${row.created_at}`);
  console.log(`  wheels: F=${frontWidth}" R=${rearWidth}" (count: ${wheels.length})`);
}

await pool.end();
