const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function show() {
  const result = await pool.query(`
    SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm
    FROM vehicle_fitments 
    WHERE center_bore_mm IS NULL
    ORDER BY make, model, year
  `);

  console.log('Remaining records missing centerbore:\n');
  
  const byMake = {};
  result.rows.forEach(row => {
    const key = `${row.make} ${row.model}`;
    if (!byMake[key]) byMake[key] = { rows: [], bolt: row.bolt_pattern };
    byMake[key].rows.push(row);
  });

  Object.entries(byMake).forEach(([key, data]) => {
    const years = data.rows.map(r => r.year).sort((a,b) => a-b);
    const yearRange = years[0] === years[years.length-1] ? years[0] : `${years[0]}-${years[years.length-1]}`;
    console.log(`${key} (${yearRange}) [${data.bolt}] - ${data.rows.length} records`);
  });

  console.log(`\nTotal: ${result.rows.length} records`);

  // Show unique bolt patterns missing data
  const bolts = await pool.query(`
    SELECT DISTINCT bolt_pattern, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE center_bore_mm IS NULL
    GROUP BY bolt_pattern
    ORDER BY cnt DESC
  `);
  
  console.log('\nBy bolt pattern:');
  bolts.rows.forEach(r => console.log(`  ${r.bolt_pattern}: ${r.cnt}`));

  await pool.end();
}

show().catch(e => { console.error(e); process.exit(1); });
