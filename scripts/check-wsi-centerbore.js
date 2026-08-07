require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check centerbore values for 20" 5x120.65 wheels
  const { rows } = await pool.query(`
    SELECT sku, brand, style, diameter, centerbore, wsi_stock, alt_stock
    FROM wsi_wheels
    WHERE bp1 = '5x120.65'
      AND diameter = '20'
      AND (wsi_stock > 0 OR alt_stock > 0)
    LIMIT 20
  `);
  
  console.log('20" 5x120.65 wheels - checking centerbore:\n');
  console.log('Vehicle hub bore: 70.3mm (wheel centerbore must be >= 70.3mm to fit)\n');
  
  rows.forEach(r => {
    const cb = parseFloat(r.centerbore) || 0;
    const fits = cb >= 70.3 ? '✅' : '❌';
    console.log(`${fits} ${r.brand} ${r.style} - centerbore: ${r.centerbore}mm`);
  });
  
  // Count by centerbore
  const { rows: byCB } = await pool.query(`
    SELECT centerbore, COUNT(*) as cnt
    FROM wsi_wheels
    WHERE bp1 = '5x120.65'
      AND diameter::int >= 20
      AND (wsi_stock > 0 OR alt_stock > 0)
    GROUP BY centerbore
    ORDER BY centerbore::numeric
  `);
  
  console.log('\n\n20"+ 5x120.65 wheels by centerbore:');
  byCB.forEach(r => {
    const cb = parseFloat(r.centerbore) || 0;
    const fits = cb >= 70.3 ? '✅' : '❌';
    console.log(`  ${fits} ${r.centerbore}mm: ${r.cnt} wheels`);
  });
  
  await pool.end();
}
check();
