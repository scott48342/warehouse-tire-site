const { getPool } = require('./src/lib/vehicleFitment');
async function test() {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT sku, brand, style, diameter, offset_mm, 
           wsi_stock, alt_stock, catalog_price, dealer_cost
    FROM wsi_wheels 
    WHERE (bp1 = '5-115' OR bp2 = '5-115')
    AND UPPER(brand) LIKE '%FACTORY%'
    LIMIT 10
  `);
  console.log('Factory Repro in DB:', rows.length);
  rows.forEach(r => console.log(r.sku, r.brand, r.diameter, r.catalog_price, r.dealer_cost, r.wsi_stock + r.alt_stock));
  process.exit(0);
}
test();
