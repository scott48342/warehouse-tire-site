require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const { rows } = await pool.query(`
    SELECT diameter, COUNT(*) as cnt
    FROM wsi_wheels
    WHERE (bp1 LIKE '%120.65%' OR bp1 LIKE '%4.75%')
      AND (wsi_stock > 0 OR alt_stock > 0)
    GROUP BY diameter
    ORDER BY diameter::numeric
  `);
  
  console.log('5x120.65 wheels IN STOCK (wsi_wheels) by diameter:');
  rows.forEach(row => console.log(`  ${row.diameter}": ${row.cnt}`));
  
  // Sample some 20" wheels
  const { rows: samples } = await pool.query(`
    SELECT sku, brand, style, diameter, width, bp1, wsi_stock, alt_stock, dealer_cost, catalog_price
    FROM wsi_wheels
    WHERE (bp1 LIKE '%120.65%' OR bp1 LIKE '%4.75%')
      AND diameter = '20'
      AND (wsi_stock > 0 OR alt_stock > 0)
    LIMIT 10
  `);
  
  console.log('\nSample 20" wheels in stock:');
  samples.forEach(r => console.log(`  ${r.brand} ${r.style} ${r.diameter}x${r.width} - stock: ${r.wsi_stock}/${r.alt_stock}, cost: $${r.dealer_cost}`));
  
  await pool.end();
}
check();
