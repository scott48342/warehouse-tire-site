const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // Find abandoned carts with Toyo tires
  const abandoned = await pool.query(`
    SELECT * FROM abandoned_carts 
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
  `);
  
  for (const cart of abandoned.rows) {
    const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
    if (!items || !Array.isArray(items)) continue;
    
    const hasToyo = items.some(i => 
      i.brand?.toLowerCase() === 'toyo' || 
      i.sku === '358060'
    );
    
    if (hasToyo) {
      console.log('=== Customer Info ===');
      console.log('Name:', cart.customer_first_name, cart.customer_last_name);
      console.log('Email:', cart.customer_email);
      console.log('Phone:', cart.customer_phone);
      console.log('Vehicle:', cart.vehicle_year, cart.vehicle_make, cart.vehicle_model, cart.vehicle_trim);
      console.log('IP:', cart.ip_address);
      console.log('Cart ID:', cart.cart_id);
      console.log('\n=== Cart Items ===');
      items.forEach(item => {
        console.log('-', item.brand, item.model);
        console.log('  SKU:', item.sku, '| Qty:', item.quantity, '| Price: $' + item.unitPrice);
      });
      console.log('\n');
    }
  }
  
  await pool.end();
}

check().catch(console.error);
