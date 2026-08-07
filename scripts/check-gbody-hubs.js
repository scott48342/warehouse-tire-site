require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check vehicle_fitments for G-body cars (5x120.65, 1978-1988)
  const { rows } = await pool.query(`
    SELECT year, make, model, center_bore_mm, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE bolt_pattern = '5x120.65' 
      AND year BETWEEN 1978 AND 1988
    GROUP BY year, make, model, center_bore_mm
    ORDER BY center_bore_mm DESC, make, model, year
  `);
  
  console.log('G-Body vehicles (5x120.65, 1978-1988) hub bores:\n');
  
  const byBore = {};
  rows.forEach(r => {
    const bore = r.center_bore_mm || 'NULL';
    if (!byBore[bore]) byBore[bore] = [];
    byBore[bore].push(`${r.year} ${r.make} ${r.model}`);
  });
  
  for (const [bore, vehicles] of Object.entries(byBore).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))) {
    console.log(`${bore}mm: ${vehicles.length} year/model combos`);
    vehicles.slice(0, 8).forEach(v => console.log(`  ${v}`));
    if (vehicles.length > 8) console.log(`  ... and ${vehicles.length - 8} more`);
    console.log('');
  }
  
  await pool.end();
}
check();
