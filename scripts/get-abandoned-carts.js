const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const { rows } = await pool.query(`
    SELECT 
      cart_id,
      customer_email,
      items,
      estimated_total,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      abandoned_at
    FROM abandoned_carts 
    WHERE status = 'abandoned' 
      AND items IS NOT NULL 
      AND estimated_total > 100
    ORDER BY abandoned_at DESC 
    LIMIT 5
  `);
  
  for (const cart of rows) {
    console.log('='.repeat(60));
    console.log('Cart:', cart.cart_id.slice(0,8));
    console.log('Vehicle:', cart.vehicle_year, cart.vehicle_make, cart.vehicle_model);
    console.log('Total:', '$' + Number(cart.estimated_total).toFixed(2));
    console.log('Abandoned:', cart.abandoned_at);
    
    const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
    for (const item of items) {
      if (item.type === 'tire') {
        console.log('  TIRE:', item.brand, item.model, item.size, '- $' + item.unitPrice + ' x', item.quantity);
      } else if (item.type === 'wheel') {
        console.log('  WHEEL:', item.brand, item.model, item.diameter + 'x' + item.width, '- $' + item.unitPrice + ' x', item.quantity);
      }
    }
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
