const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function show() {
  const result = await pool.query(`
    SELECT year, make, model, display_trim, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb
    ORDER BY make, model, year
  `);

  console.log('Remaining records missing tire sizes:\n');
  
  const byModel = {};
  result.rows.forEach(row => {
    const key = `${row.make} ${row.model}`;
    if (!byModel[key]) byModel[key] = [];
    byModel[key].push(row);
  });

  Object.entries(byModel).forEach(([key, rows]) => {
    const years = rows.map(r => r.year).sort((a,b) => a-b);
    const yearRange = years[0] === years[years.length-1] ? years[0] : `${years[0]}-${years[years.length-1]}`;
    const hasWheels = rows.filter(r => r.oem_wheel_sizes && JSON.stringify(r.oem_wheel_sizes) !== '[]').length;
    console.log(`${key} (${yearRange}) - ${rows.length} records, ${hasWheels} have wheel data`);
  });

  console.log(`\nTotal: ${result.rows.length} records`);

  await pool.end();
}

show().catch(e => { console.error(e); process.exit(1); });
