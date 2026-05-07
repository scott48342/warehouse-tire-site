import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 3,
    ssl: { rejectUnauthorized: false },
  });
  
  // Check WheelPros tire inventory for 285/70R17
  console.log('=== WheelPros Tires with 285/70R17 ===');
  const { rows: wpTires } = await pool.query(`
    SELECT t.sku, t.brand, t.description, t.size, i.qty_on_hand
    FROM wp_tires t
    LEFT JOIN wheelpros_inventory i ON i.sku = t.sku
    WHERE t.simple_size = '2857017'
    ORDER BY i.qty_on_hand DESC NULLS LAST
    LIMIT 20
  `);
  
  console.log('Found:', wpTires.length, 'tires');
  wpTires.forEach(t => {
    console.log(`  ${t.brand} ${t.description} - SKU: ${t.sku} - Qty: ${t.qty_on_hand ?? 'NULL'}`);
  });
  
  // Check total inventory
  console.log('\n=== Total Inventory Stats ===');
  const { rows: stats } = await pool.query(`
    SELECT 
      COUNT(*) as total_tires,
      COUNT(CASE WHEN i.qty_on_hand > 0 THEN 1 END) as in_stock,
      SUM(i.qty_on_hand) as total_qty
    FROM wp_tires t
    LEFT JOIN wheelpros_inventory i ON i.sku = t.sku
    WHERE t.simple_size = '2857017'
  `);
  
  console.log('Stats:', stats[0]);
  
  await pool.end();
}

main().catch(console.error);
