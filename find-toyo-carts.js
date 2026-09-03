const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function search() {
  // Check abandoned_carts
  const abandoned = await pool.query(`
    SELECT id, customer_email, items, created_at 
    FROM abandoned_carts 
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 50
  `);
  
  console.log('Checking', abandoned.rows.length, 'abandoned carts...');
  
  for (const cart of abandoned.rows) {
    try {
      const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
      if (!items || !Array.isArray(items)) continue;
      
      const toyoItems = items.filter(i => 
        i.brand?.toLowerCase() === 'toyo' || 
        i.model?.toLowerCase().includes('toyo') ||
        i.sku === '358060'
      );
      
      if (toyoItems.length > 0) {
        console.log('\n=== Abandoned Cart ===');
        console.log('ID:', cart.id);
        console.log('Email:', cart.customer_email || 'none');
        console.log('Created:', cart.created_at);
        toyoItems.forEach(item => {
          console.log('  -', item.brand, item.model);
          console.log('    SKU:', item.sku, '| Qty:', item.quantity);
        });
      }
    } catch (e) {}
  }
  
  // Check cart_add_events for Toyo
  const events = await pool.query(`
    SELECT id, brand, product_name, sku, quantity, cart_id, session_id, created_at
    FROM cart_add_events 
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND (LOWER(brand) = 'toyo' OR sku = '358060')
    ORDER BY created_at DESC
    LIMIT 20
  `);
  
  console.log('\nRecent Toyo cart_add_events:', events.rows.length);
  for (const e of events.rows) {
    console.log('\n  Event ID:', e.id);
    console.log('  Product:', e.brand, e.product_name);
    console.log('  SKU:', e.sku, '| Qty:', e.quantity);
    console.log('  Cart ID:', e.cart_id);
    console.log('  Created:', e.created_at);
  }
  
  await pool.end();
}

search().catch(console.error);
