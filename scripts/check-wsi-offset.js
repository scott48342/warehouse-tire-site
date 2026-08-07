require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check offset values for 20" 5x120.65 wheels
  // Classic fitment envelope allows -10 to +38mm
  const { rows } = await pool.query(`
    SELECT sku, brand, style, diameter, width, offset_mm, centerbore
    FROM wsi_wheels
    WHERE bp1 = '5x120.65'
      AND diameter::int >= 20
      AND (wsi_stock > 0 OR alt_stock > 0)
    ORDER BY offset_mm::int
    LIMIT 30
  `);
  
  console.log('20"+ 5x120.65 wheels - checking offset:\n');
  console.log('Classic fitment envelope: offset -10mm to +38mm\n');
  
  rows.forEach(r => {
    const off = parseInt(r.offset_mm) || 0;
    const fits = (off >= -10 && off <= 38) ? '✅' : '❌';
    console.log(`${fits} ${r.brand} ${r.style} ${r.diameter}x${r.width} - offset: ${r.offset_mm}mm`);
  });
  
  // Count by offset range
  const { rows: byOff } = await pool.query(`
    SELECT 
      CASE 
        WHEN offset_mm::int < -10 THEN 'too_negative'
        WHEN offset_mm::int > 38 THEN 'too_positive'
        ELSE 'in_range'
      END as range,
      COUNT(*) as cnt
    FROM wsi_wheels
    WHERE bp1 = '5x120.65'
      AND diameter::int >= 20
      AND (wsi_stock > 0 OR alt_stock > 0)
    GROUP BY range
  `);
  
  console.log('\n\nOffset range summary:');
  byOff.forEach(r => console.log(`  ${r.range}: ${r.cnt} wheels`));
  
  await pool.end();
}
check();
