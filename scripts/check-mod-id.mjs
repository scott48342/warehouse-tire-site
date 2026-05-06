import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check exact modification_id
const result = await pool.query(`
  SELECT modification_id, display_trim, 
         jsonb_array_length(oem_wheel_sizes) as wheel_count
  FROM vehicle_fitments
  WHERE make = 'Dodge' AND model = 'Challenger' AND year = 2023
  ORDER BY modification_id
`);

console.log('2023 Dodge Challenger modification_ids:');
for (const row of result.rows) {
  console.log(`  mod_id="${row.modification_id}" display="${row.display_trim}" wheels=${row.wheel_count}`);
}

// Check what a query with spaces returns
const spaced = await pool.query(`
  SELECT modification_id, display_trim, oem_wheel_sizes
  FROM vehicle_fitments
  WHERE make = 'Dodge' AND model = 'Challenger' AND year = 2023
  AND (modification_id = 'srt hellcat widebody' OR modification_id = 'srt-hellcat-widebody')
`);

console.log('\nQuery with "srt hellcat widebody" OR "srt-hellcat-widebody":');
console.log('  Found:', spaced.rows.length, 'records');
if (spaced.rows.length > 0) {
  console.log('  mod_id:', spaced.rows[0].modification_id);
  console.log('  wheels:', JSON.stringify(spaced.rows[0].oem_wheel_sizes));
}

await pool.end();
