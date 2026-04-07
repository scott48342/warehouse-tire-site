const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  // Check wp_tires count for 225/55R17
  const tiresResult = await pool.query(`
    SELECT t.sku, t.brand_desc, t.tire_size, COALESCE(i.qoh, 0) as stock 
    FROM wp_tires t 
    LEFT JOIN wp_inventory i ON i.sku = t.sku AND i.product_type = 'tire' AND i.location_id = 'TOTAL' 
    WHERE t.simple_size = '2255517' 
    ORDER BY COALESCE(i.qoh, 0) DESC 
    LIMIT 30
  `);
  
  console.log(`\n=== wp_tires for 225/55R17 (simple_size = 2255517) ===`);
  console.log(`Total rows: ${tiresResult.rows.length}`);
  
  const withStock = tiresResult.rows.filter(r => r.stock >= 4);
  const noStock = tiresResult.rows.filter(r => r.stock < 4);
  
  console.log(`With stock >= 4: ${withStock.length}`);
  console.log(`With stock < 4: ${noStock.length}`);
  
  console.log(`\nTop 15 by stock:`);
  tiresResult.rows.slice(0, 15).forEach(row => {
    console.log(`  ${row.sku} | ${row.brand_desc} | ${row.tire_size} | stock: ${row.stock}`);
  });
  
  // Check inventory table health
  const invCount = await pool.query(`
    SELECT COUNT(*) as cnt, MAX(updated_at) as last_update 
    FROM wp_inventory 
    WHERE product_type = 'tire'
  `);
  console.log(`\n=== wp_inventory (tires) ===`);
  console.log(`Total rows: ${invCount.rows[0].cnt}`);
  console.log(`Last update: ${invCount.rows[0].last_update}`);
  
  // Check TOTAL location specifically
  const totalLoc = await pool.query(`
    SELECT COUNT(*) as cnt 
    FROM wp_inventory 
    WHERE product_type = 'tire' AND location_id = 'TOTAL'
  `);
  console.log(`TOTAL location rows: ${totalLoc.rows[0].cnt}`);
  
  // Check if there are ANY tires with stock
  const anyStock = await pool.query(`
    SELECT COUNT(*) as cnt 
    FROM wp_inventory 
    WHERE product_type = 'tire' AND location_id = 'TOTAL' AND qoh >= 4
  `);
  console.log(`Tires with qoh >= 4: ${anyStock.rows[0].cnt}`);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
