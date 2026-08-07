// Test the WSI pipeline end-to-end
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function test() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  const bp = '5x120.65';
  console.log(`Testing WSI query for bolt pattern "${bp}"...\n`);
  
  // This is exactly what getWSICandidatesByBoltPattern does
  const { rows } = await pool.query(`
    SELECT
      sku, brand, style, finish,
      diameter::text, width::text,
      bp1, bp2,
      offset_mm::text, centerbore::text,
      wsi_stock, alt_stock,
      catalog_price::text, dealer_cost::text
    FROM wsi_wheels
    WHERE bp1 = $1 OR bp2 = $1
    ORDER BY
      (COALESCE(wsi_stock, 0) + COALESCE(alt_stock, 0) > 0) DESC,
      catalog_price ASC NULLS LAST
  `, [bp]);
  
  console.log(`Total rows returned: ${rows.length}`);
  
  // Check 20" wheels
  const wheels20 = rows.filter(r => parseInt(r.diameter) >= 20);
  console.log(`20"+ rows: ${wheels20.length}`);
  
  // Check in-stock 20" wheels with offset in range
  const valid20 = wheels20.filter(r => {
    const inStock = (parseInt(r.wsi_stock) || 0) + (parseInt(r.alt_stock) || 0) > 0;
    const offset = parseInt(r.offset_mm) || 0;
    const offsetOk = offset >= -10 && offset <= 38;
    return inStock && offsetOk;
  });
  console.log(`In-stock 20"+ with valid offset (-10 to +38): ${valid20.length}`);
  
  // Show all valid 20"+ wheels
  console.log('\nValid 20"+ wheels (in stock, offset OK):');
  valid20.forEach(r => {
    console.log(`  ${r.brand} ${r.style} ${r.diameter}x${r.width} offset:${r.offset_mm} cb:${r.centerbore} stock:${r.wsi_stock}/${r.alt_stock}`);
  });
  
  await pool.end();
}

test().catch(e => { console.error(e); process.exit(1); });
