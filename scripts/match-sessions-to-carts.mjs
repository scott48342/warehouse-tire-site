import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Get recent checkout sessions
  const { rows: checkoutSessions } = await pool.query(`
    SELECT DISTINCT pv.session_id, MAX(pv.timestamp) as checkout_time
    FROM analytics_pageviews pv
    WHERE pv.path LIKE '%checkout%'
    AND pv.path NOT LIKE '%success%'
    AND pv.timestamp > NOW() - INTERVAL '3 days'
    GROUP BY pv.session_id
    ORDER BY checkout_time DESC
    LIMIT 10
  `);
  
  console.log('=== Sessions that reached /checkout (3 days) ===\n');
  
  for (const sess of checkoutSessions) {
    // Check if this session has an abandoned cart
    const { rows: carts } = await pool.query(`
      SELECT cart_id, status, item_count, estimated_total, customer_email, created_at
      FROM abandoned_carts
      WHERE session_id = $1
    `, [sess.session_id]);
    
    const cartInfo = carts.length > 0 
      ? `✅ CART: ${carts[0].status}, ${carts[0].item_count} items, $${carts[0].estimated_total}`
      : `❌ NO CART`;
    
    console.log(`${sess.session_id.slice(0,25)}...`);
    console.log(`  Checkout at: ${sess.checkout_time.toISOString().slice(0,16)}`);
    console.log(`  ${cartInfo}`);
    console.log('');
  }
  
  // Check if cart_id vs session_id is the issue
  const { rows: cartSessions } = await pool.query(`
    SELECT session_id, COUNT(*)::int as count
    FROM abandoned_carts
    WHERE session_id IS NOT NULL
    GROUP BY session_id
    ORDER BY count DESC
    LIMIT 5
  `);
  
  console.log('=== Carts with session_id ===');
  cartSessions.forEach(r => {
    console.log(`${r.session_id?.slice(0,25)}... | ${r.count} carts`);
  });
  
  // Check cart_id format
  const { rows: cartFormats } = await pool.query(`
    SELECT cart_id, session_id, created_at
    FROM abandoned_carts
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  console.log('\n=== Recent Cart IDs vs Session IDs ===');
  cartFormats.forEach(r => {
    console.log(`cart: ${r.cart_id?.slice(0,20)} | session: ${r.session_id?.slice(0,20) || 'NULL'}`);
  });
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
