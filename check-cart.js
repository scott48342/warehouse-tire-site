const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // Check abandoned_carts for that cart
  const abandoned = await pool.query(
    `SELECT * FROM abandoned_carts WHERE cart_id = $1 ORDER BY created_at DESC LIMIT 1`,
    ['msdetqcm-12l0fl1h']
  );
  
  if (abandoned.rows.length > 0) {
    console.log('=== Abandoned Cart Record ===');
    const cart = abandoned.rows[0];
    console.log('ID:', cart.id);
    console.log('Subtotal:', cart.subtotal);
    console.log('Estimated Total:', cart.estimated_total);
    console.log('Status:', cart.status);
    console.log('\nAll columns:', Object.keys(cart).join(', '));
  } else {
    console.log('No abandoned cart record found for this cart_id');
  }
  
  // Check the cart_add_events to see what's captured
  const events = await pool.query(
    `SELECT * FROM cart_add_events WHERE cart_id = $1 ORDER BY created_at DESC LIMIT 1`,
    ['msdetqcm-12l0fl1h']
  );
  
  if (events.rows.length > 0) {
    console.log('\n=== Cart Add Event Record ===');
    const event = events.rows[0];
    console.log('All columns:', Object.keys(event).join(', '));
  }
  
  await pool.end();
}

check().catch(console.error);
