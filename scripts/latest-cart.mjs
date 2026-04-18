import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const { rows } = await pool.query(`
  SELECT cart_id, customer_email, customer_first_name, customer_phone,
         vehicle_year, vehicle_make, vehicle_model, vehicle_trim,
         estimated_total, item_count, items,
         status, created_at, abandoned_at, hostname
  FROM abandoned_carts 
  ORDER BY COALESCE(abandoned_at, created_at) DESC 
  LIMIT 3
`);

for (const cart of rows) {
  console.log('\n' + '='.repeat(50));
  console.log('Cart ID:', cart.cart_id);
  console.log('Status:', cart.status);
  console.log('Site:', cart.hostname || 'unknown');
  console.log('Customer:', cart.customer_first_name || '(no name)');
  console.log('Email:', cart.customer_email || '(none)');
  console.log('Phone:', cart.customer_phone || '(none)');
  console.log('Vehicle:', [cart.vehicle_year, cart.vehicle_make, cart.vehicle_model, cart.vehicle_trim].filter(Boolean).join(' '));
  console.log('Total: $' + Number(cart.estimated_total).toFixed(2));
  console.log('Items:', cart.item_count);
  
  const items = cart.items || [];
  items.forEach(i => {
    console.log('  -', i.quantity + 'x', i.brand, i.model, '@ $' + i.unitPrice);
  });
  
  console.log('Created:', cart.created_at);
  console.log('Abandoned:', cart.abandoned_at || 'still active');
}

await pool.end();
