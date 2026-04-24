const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

(async () => {
  const r = await pool.query(`
    SELECT modification_id, display_trim, oem_wheel_sizes, quality_tier
    FROM vehicle_fitments 
    WHERE year = 2020 AND LOWER(make) = 'chevrolet' AND LOWER(model) = 'corvette'
    LIMIT 5
  `);
  
  console.log('Corvette fitments:');
  r.rows.forEach(row => {
    console.log(`\n${row.display_trim} (${row.modification_id}):`);
    console.log('  Quality tier:', row.quality_tier);
    console.log('  OEM wheel sizes:', JSON.stringify(row.oem_wheel_sizes, null, 4));
  });
  
  await pool.end();
})();
