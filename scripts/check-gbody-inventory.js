require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check wheel inventory for 5x120.65 in all sizes
  const { rows } = await pool.query(`
    SELECT diameter, COUNT(*) as cnt, source
    FROM wheel_inventory
    WHERE (bolt_pattern_metric ILIKE '%120.65%' OR bolt_pattern_standard ILIKE '%4.75%')
      AND in_stock = true
    GROUP BY diameter, source
    ORDER BY diameter::numeric, source
  `);
  
  console.log('5x120.65 / 5x4.75 IN-STOCK wheels by diameter and source:\n');
  
  const byDiameter = {};
  rows.forEach(r => {
    const dia = r.diameter;
    if (!byDiameter[dia]) byDiameter[dia] = {};
    byDiameter[dia][r.source] = parseInt(r.cnt);
  });
  
  console.log('Diameter | WheelPros | WSI | American Racing | Total');
  console.log('---------|-----------|-----|-----------------|------');
  
  const diameters = Object.keys(byDiameter).sort((a, b) => parseFloat(a) - parseFloat(b));
  for (const dia of diameters) {
    const sources = byDiameter[dia];
    const wp = sources['wheelpros'] || sources['sftp'] || 0;
    const wsi = sources['wsi'] || 0;
    const ar = sources['american_racing'] || 0;
    const total = wp + wsi + ar;
    console.log(`${dia.padStart(8)} | ${String(wp).padStart(9)} | ${String(wsi).padStart(3)} | ${String(ar).padStart(15)} | ${total}`);
  }
  
  // Also check what's NOT in stock
  console.log('\n\n--- Including OUT OF STOCK wheels ---\n');
  
  const { rows: allRows } = await pool.query(`
    SELECT diameter, COUNT(*) as cnt, source, SUM(CASE WHEN in_stock THEN 1 ELSE 0 END) as in_stock_cnt
    FROM wheel_inventory
    WHERE (bolt_pattern_metric ILIKE '%120.65%' OR bolt_pattern_standard ILIKE '%4.75%')
    GROUP BY diameter, source
    ORDER BY diameter::numeric, source
  `);
  
  const byDia2 = {};
  allRows.forEach(r => {
    const dia = r.diameter;
    if (!byDia2[dia]) byDia2[dia] = { total: 0, inStock: 0 };
    byDia2[dia].total += parseInt(r.cnt);
    byDia2[dia].inStock += parseInt(r.in_stock_cnt);
  });
  
  console.log('Diameter | Total SKUs | In Stock');
  console.log('---------|------------|----------');
  for (const dia of Object.keys(byDia2).sort((a, b) => parseFloat(a) - parseFloat(b))) {
    const d = byDia2[dia];
    console.log(`${dia.padStart(8)} | ${String(d.total).padStart(10)} | ${d.inStock}`);
  }
  
  await pool.end();
}
check();
