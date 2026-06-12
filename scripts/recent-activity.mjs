/**
 * Check recent checkout/cart activity
 */
import pg from 'pg';
const { Pool } = pg;

const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connString,
  ssl: connString?.includes('prisma.io') ? { rejectUnauthorized: false } : false
});

async function check() {
  // Check when carts were created/abandoned
  console.log('=== ABANDONED CARTS TIMELINE ===');
  const cartTimeline = await pool.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as carts_created,
      SUM(estimated_total::numeric) as value
    FROM abandoned_carts
    WHERE is_test = false
      AND created_at > NOW() - INTERVAL '60 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `);
  
  console.log('Carts created by day (last 30 days with activity):');
  cartTimeline.rows.forEach(r => {
    console.log(`  ${r.date.toISOString().slice(0,10)}: ${r.carts_created} carts, $${parseFloat(r.value).toFixed(0)}`);
  });

  // Check funnel events if they exist
  console.log('\n=== FUNNEL EVENTS (last 30 days) ===');
  try {
    const funnel = await pool.query(`
      SELECT 
        event_type,
        COUNT(*) as count,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM funnel_events
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY event_type
      ORDER BY count DESC
    `);
    
    if (funnel.rows.length > 0) {
      console.log('Funnel events:');
      funnel.rows.forEach(r => console.log(`  ${r.event_type}: ${r.count} (${r.unique_sessions} sessions)`));
    } else {
      console.log('No funnel events found');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Check Jake analytics for checkout-related conversations
  console.log('\n=== JAKE CHECKOUT CONVERSATIONS ===');
  try {
    const jake = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as conversations
      FROM jake_analytics_events
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 10
    `);
    
    if (jake.rows.length > 0) {
      console.log('Jake conversations by day:');
      jake.rows.forEach(r => console.log(`  ${r.date.toISOString().slice(0,10)}: ${r.conversations}`));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Check pageviews for checkout page
  console.log('\n=== CHECKOUT PAGE VIEWS ===');
  try {
    const checkoutViews = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as views
      FROM analytics_pageviews
      WHERE path LIKE '%checkout%'
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 15
    `);
    
    if (checkoutViews.rows.length > 0) {
      console.log('Checkout page views by day:');
      checkoutViews.rows.forEach(r => console.log(`  ${r.date.toISOString().slice(0,10)}: ${r.views} views`));
    } else {
      console.log('No checkout pageviews found');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Check cart page views
  console.log('\n=== CART PAGE VIEWS ===');
  try {
    const cartViews = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as views
      FROM analytics_pageviews
      WHERE path LIKE '%cart%'
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 15
    `);
    
    if (cartViews.rows.length > 0) {
      console.log('Cart page views by day:');
      cartViews.rows.forEach(r => console.log(`  ${r.date.toISOString().slice(0,10)}: ${r.views} views`));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Most recent abandoned carts with emails
  console.log('\n=== MOST RECENT ABANDONED CARTS ===');
  const recentCarts = await pool.query(`
    SELECT 
      cart_id,
      customer_email,
      estimated_total::numeric as total,
      status,
      created_at,
      abandoned_at,
      vehicle_year || ' ' || vehicle_make || ' ' || vehicle_model as vehicle
    FROM abandoned_carts
    WHERE is_test = false
    ORDER BY created_at DESC
    LIMIT 15
  `);
  
  console.log('Most recent carts:');
  recentCarts.rows.forEach(c => {
    const date = c.created_at.toISOString().slice(0,10);
    console.log(`  ${date} | $${parseFloat(c.total).toFixed(0).padStart(5)} | ${(c.customer_email || 'NO EMAIL').padEnd(30)} | ${c.status}`);
  });

  // Check if any abandoned carts were recovered (became orders)
  console.log('\n=== RECOVERED CARTS ===');
  const recovered = await pool.query(`
    SELECT 
      cart_id,
      customer_email,
      estimated_total::numeric as total,
      recovered_order_id,
      recovered_at
    FROM abandoned_carts
    WHERE status = 'recovered'
      AND is_test = false
    ORDER BY recovered_at DESC
    LIMIT 10
  `);
  
  if (recovered.rows.length > 0) {
    console.log('Recovered carts:');
    recovered.rows.forEach(c => {
      console.log(`  ${c.cart_id} → ${c.recovered_order_id} | ${c.customer_email} | $${parseFloat(c.total).toFixed(0)}`);
    });
  } else {
    console.log('No recovered carts found');
  }

  await pool.end();
}

check().catch(console.error);
