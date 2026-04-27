import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

// Check for any cart-related activity in other tables
console.log('=== CART ACTIVITY AUDIT ===\n');

// Check product popularity table (the other tracking system)
try {
  const pop = await pool.query(`
    SELECT event_type, COUNT(*) as count 
    FROM product_popularity 
    WHERE created_at > NOW() - INTERVAL '3 days'
    GROUP BY event_type
    ORDER BY count DESC
  `);
  console.log('product_popularity events (3 days):');
  if (pop.rows.length === 0) {
    console.log('  (no events)');
  } else {
    pop.rows.forEach(r => console.log(`  ${r.event_type}: ${r.count}`));
  }
} catch (err) {
  console.log('  Error querying product_popularity:', err.message);
}

// Check for any "cart" related events in funnel_events
console.log('\n\nfunnel_events with "cart" in event_name:');
const cart = await pool.query(`
  SELECT event_name, COUNT(*) as count
  FROM funnel_events
  WHERE event_name ILIKE '%cart%'
  GROUP BY event_name
`);
if (cart.rows.length === 0) {
  console.log('  (no cart events found)');
} else {
  cart.rows.forEach(r => console.log(`  ${r.event_name}: ${r.count}`));
}

// Check for checkout events
console.log('\n\nfunnel_events with "checkout" in event_name:');
const checkout = await pool.query(`
  SELECT event_name, COUNT(*) as count
  FROM funnel_events
  WHERE event_name ILIKE '%checkout%'
  GROUP BY event_name
`);
if (checkout.rows.length === 0) {
  console.log('  (no checkout events found)');
} else {
  checkout.rows.forEach(r => console.log(`  ${r.event_name}: ${r.count}`));
}

// Check if there are any orders at all in the timeframe
console.log('\n\norders in last 3 days:');
try {
  const orders = await pool.query(`
    SELECT COUNT(*) as count FROM orders WHERE created_at > NOW() - INTERVAL '3 days'
  `);
  console.log(`  ${orders.rows[0]?.count || 0} orders`);
} catch (err) {
  console.log('  Error or no orders table:', err.message);
}

await pool.end();
