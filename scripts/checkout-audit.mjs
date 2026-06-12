/**
 * P0 Checkout Completion Audit
 * Investigate why customers are not completing checkout
 */
import pg from 'pg';
const { Pool } = pg;

const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connString,
  ssl: connString?.includes('prisma.io') || connString?.includes('neon') 
    ? { rejectUnauthorized: false } 
    : false
});

async function audit() {
  console.log('=' .repeat(70));
  console.log('P0 CHECKOUT COMPLETION AUDIT');
  console.log('=' .repeat(70));
  console.log();

  // =========================================================================
  // 1. ORDER STATUS - Are there ANY orders?
  // =========================================================================
  console.log('📦 1. ORDER STATUS');
  console.log('-'.repeat(50));
  
  try {
    const orders = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_30d,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7d,
        SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN (snapshot->>'total')::numeric ELSE 0 END) as revenue_30d
      FROM orders
    `);
    console.log('Orders table:', orders.rows[0]);

    const recentOrders = await pool.query(`
      SELECT order_id, status, created_at, 
             (snapshot->'totals'->>'total')::numeric as total,
             snapshot->'customer'->>'email' as email
      FROM orders
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log('\nMost recent orders:');
    if (recentOrders.rows.length === 0) {
      console.log('  ⚠️  NO ORDERS IN DATABASE');
    } else {
      recentOrders.rows.forEach(o => {
        console.log(`  ${o.order_id} | ${o.status} | $${o.total} | ${o.email} | ${o.created_at}`);
      });
    }
  } catch (err) {
    console.log('  Error querying orders:', err.message);
  }

  // =========================================================================
  // 2. ABANDONED CART SUMMARY
  // =========================================================================
  console.log('\n\n🛒 2. ABANDONED CART SUMMARY');
  console.log('-'.repeat(50));
  
  const cartSummary = await pool.query(`
    SELECT 
      COUNT(*) as total_carts,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned,
      COUNT(CASE WHEN status = 'recovered' THEN 1 END) as recovered,
      SUM(estimated_total::numeric) as total_value,
      SUM(CASE WHEN status != 'recovered' THEN estimated_total::numeric ELSE 0 END) as abandoned_value
    FROM abandoned_carts
    WHERE is_test = false
  `);
  console.log('Cart summary:', cartSummary.rows[0]);

  // =========================================================================
  // 3. FUNNEL ANALYSIS - Analytics Events
  // =========================================================================
  console.log('\n\n📊 3. FUNNEL ANALYSIS (Last 30 days)');
  console.log('-'.repeat(50));
  
  try {
    const funnelEvents = [
      'page_view',
      'vehicle_selected',
      'add_to_cart',
      'cart_viewed',
      'begin_checkout',
      'checkout_started',
      'checkout_page_loaded',
      'shipping_info_entered',
      'shipping_rate_requested',
      'shipping_rate_success',
      'shipping_rate_failed',
      'payment_info_entered',
      'payment_started',
      'payment_intent_created',
      'payment_succeeded',
      'payment_failed',
      'order_created',
      'purchase',
      'checkout_completed'
    ];

    const funnel = await pool.query(`
      SELECT event_name, COUNT(*) as count
      FROM analytics_events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND event_name = ANY($1)
      GROUP BY event_name
      ORDER BY count DESC
    `, [funnelEvents]);
    
    console.log('Event counts (30 days):');
    const eventMap = {};
    funnel.rows.forEach(r => {
      eventMap[r.event_name] = parseInt(r.count);
      console.log(`  ${r.event_name}: ${r.count}`);
    });

    // Calculate conversion rates
    console.log('\nConversion rates:');
    const addToCart = eventMap['add_to_cart'] || 0;
    const beginCheckout = eventMap['begin_checkout'] || eventMap['checkout_started'] || 0;
    const paymentStarted = eventMap['payment_started'] || eventMap['payment_intent_created'] || 0;
    const paymentSucceeded = eventMap['payment_succeeded'] || 0;
    const orderCreated = eventMap['order_created'] || eventMap['purchase'] || 0;

    if (addToCart > 0) console.log(`  Add to Cart → Begin Checkout: ${((beginCheckout/addToCart)*100).toFixed(1)}%`);
    if (beginCheckout > 0) console.log(`  Begin Checkout → Payment Started: ${((paymentStarted/beginCheckout)*100).toFixed(1)}%`);
    if (paymentStarted > 0) console.log(`  Payment Started → Payment Succeeded: ${((paymentSucceeded/paymentStarted)*100).toFixed(1)}%`);
    if (paymentSucceeded > 0) console.log(`  Payment Succeeded → Order Created: ${((orderCreated/paymentSucceeded)*100).toFixed(1)}%`);

  } catch (err) {
    console.log('  Error querying analytics:', err.message);
  }

  // =========================================================================
  // 4. HIGH-VALUE ABANDONED CARTS - Stage Classification
  // =========================================================================
  console.log('\n\n💰 4. HIGH-VALUE ABANDONED CARTS (>$500)');
  console.log('-'.repeat(50));
  
  const highValueCarts = await pool.query(`
    SELECT 
      cart_id,
      customer_email,
      customer_first_name,
      estimated_total::numeric as total,
      status,
      created_at,
      abandoned_at,
      email_sent_count,
      source,
      vehicle_year || ' ' || vehicle_make || ' ' || vehicle_model as vehicle
    FROM abandoned_carts
    WHERE is_test = false
      AND estimated_total::numeric > 500
    ORDER BY estimated_total::numeric DESC
    LIMIT 20
  `);
  
  console.log(`Found ${highValueCarts.rows.length} high-value carts:\n`);
  highValueCarts.rows.forEach(c => {
    console.log(`  $${parseFloat(c.total).toFixed(0).padStart(6)} | ${c.customer_email || 'NO EMAIL'.padEnd(30)} | ${c.vehicle || 'No vehicle'} | ${c.status}`);
  });

  // =========================================================================
  // 5. CHECKOUT SESSIONS - Stripe
  // =========================================================================
  console.log('\n\n💳 5. STRIPE CHECKOUT SESSIONS');
  console.log('-'.repeat(50));
  
  try {
    // Check if there's a checkout_sessions table
    const sessionsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'checkout_sessions'
      )
    `);
    
    if (sessionsCheck.rows[0].exists) {
      const sessions = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM checkout_sessions
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY status
      `);
      console.log('Checkout session statuses (30 days):');
      sessions.rows.forEach(s => console.log(`  ${s.status}: ${s.count}`));
    } else {
      console.log('  No checkout_sessions table found');
    }
  } catch (err) {
    console.log('  Error:', err.message);
  }

  // =========================================================================
  // 6. PAYMENT ERRORS - Look for failures
  // =========================================================================
  console.log('\n\n❌ 6. PAYMENT/CHECKOUT ERRORS');
  console.log('-'.repeat(50));
  
  try {
    const errors = await pool.query(`
      SELECT event_name, properties->>'error' as error, COUNT(*) as count
      FROM analytics_events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND (
          event_name LIKE '%error%' 
          OR event_name LIKE '%failed%'
          OR event_name LIKE '%failure%'
          OR properties->>'error' IS NOT NULL
        )
      GROUP BY event_name, properties->>'error'
      ORDER BY count DESC
      LIMIT 20
    `);
    
    if (errors.rows.length === 0) {
      console.log('  No error events found in analytics');
    } else {
      errors.rows.forEach(e => console.log(`  ${e.event_name}: ${e.error || 'no message'} (${e.count}x)`));
    }
  } catch (err) {
    console.log('  Error:', err.message);
  }

  // =========================================================================
  // 7. CART ADD EVENTS vs PURCHASES
  // =========================================================================
  console.log('\n\n🔄 7. CART ADD EVENTS → PURCHASES');
  console.log('-'.repeat(50));
  
  try {
    const cartAdds = await pool.query(`
      SELECT 
        COUNT(*) as total_adds,
        COUNT(CASE WHEN purchased = true THEN 1 END) as purchased,
        COUNT(DISTINCT cart_id) as unique_carts,
        SUM(price_at_time * quantity) as total_cart_value,
        SUM(CASE WHEN purchased = true THEN price_at_time * quantity ELSE 0 END) as purchased_value
      FROM cart_add_events
      WHERE is_test = false
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    console.log('Cart add events (30 days):');
    console.log('  Total adds:', cartAdds.rows[0].total_adds);
    console.log('  Purchased:', cartAdds.rows[0].purchased);
    console.log('  Unique carts:', cartAdds.rows[0].unique_carts);
    console.log('  Total cart value: $' + parseFloat(cartAdds.rows[0].total_cart_value || 0).toFixed(0));
    console.log('  Purchased value: $' + parseFloat(cartAdds.rows[0].purchased_value || 0).toFixed(0));
    
    const convRate = cartAdds.rows[0].total_adds > 0 
      ? (cartAdds.rows[0].purchased / cartAdds.rows[0].total_adds * 100).toFixed(2)
      : 0;
    console.log(`  Conversion rate: ${convRate}%`);
  } catch (err) {
    console.log('  Error:', err.message);
  }

  // =========================================================================
  // 8. RECENT CHECKOUT ATTEMPTS
  // =========================================================================
  console.log('\n\n🕐 8. RECENT CHECKOUT ACTIVITY');
  console.log('-'.repeat(50));
  
  try {
    const recentCheckout = await pool.query(`
      SELECT 
        event_name,
        properties->>'cartId' as cart_id,
        properties->>'email' as email,
        properties->>'total' as total,
        properties->>'error' as error,
        created_at
      FROM analytics_events
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND event_name IN (
          'begin_checkout', 'checkout_started', 'checkout_page_loaded',
          'payment_started', 'payment_intent_created', 
          'payment_succeeded', 'payment_failed',
          'order_created', 'purchase', 'checkout_completed'
        )
      ORDER BY created_at DESC
      LIMIT 30
    `);
    
    if (recentCheckout.rows.length === 0) {
      console.log('  ⚠️  NO CHECKOUT EVENTS IN LAST 7 DAYS');
    } else {
      recentCheckout.rows.forEach(e => {
        const time = new Date(e.created_at).toLocaleString();
        console.log(`  ${time} | ${e.event_name} | ${e.email || e.cart_id || ''} | ${e.error || ''}`);
      });
    }
  } catch (err) {
    console.log('  Error:', err.message);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\n' + '='.repeat(70));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(70));

  await pool.end();
}

audit().catch(console.error);
