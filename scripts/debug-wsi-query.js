require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check what getWSICandidatesByBoltPattern would return
  const bp = '5x120.65';
  
  const { rows } = await pool.query(`
    SELECT sku, brand, style, diameter, width, offset_mm, centerbore, wsi_stock, alt_stock
    FROM wsi_wheels
    WHERE bp1 = $1 OR bp2 = $1
    ORDER BY (COALESCE(wsi_stock, 0) + COALESCE(alt_stock, 0) > 0) DESC, catalog_price ASC NULLS LAST
  `, [bp]);
  
  console.log(`Total WSI wheels for ${bp}: ${rows.length}`);
  
  // Check in-stock 20" wheels
  const inStock20 = rows.filter(r => 
    (parseInt(r.wsi_stock) > 0 || parseInt(r.alt_stock) > 0) && 
    parseInt(r.diameter) >= 20
  );
  console.log(`\nIn-stock 20"+ wheels: ${inStock20.length}`);
  
  inStock20.slice(0, 15).forEach(r => {
    console.log(`  ${r.brand} ${r.style} ${r.diameter}x${r.width} offset:${r.offset_mm} cb:${r.centerbore} stock:${r.wsi_stock}/${r.alt_stock}`);
  });
  
  // Check B/G Rod Works specifically
  const bgrod = rows.filter(r => r.brand?.includes('B/G'));
  console.log(`\n\nB/G ROD WORKS wheels: ${bgrod.length}`);
  bgrod.forEach(r => {
    const inStock = (parseInt(r.wsi_stock) > 0 || parseInt(r.alt_stock) > 0) ? '✅' : '❌';
    console.log(`  ${inStock} ${r.sku} ${r.diameter}x${r.width} offset:${r.offset_mm} cb:${r.centerbore}`);
  });
  
  await pool.end();
}
check();
