/**
 * Traffic & Funnel Quality Audit
 * Comprehensive analysis for ROI improvement recommendations
 */
import pg from 'pg';
const { Pool } = pg;

const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connString,
  ssl: connString?.includes('prisma.io') ? { rejectUnauthorized: false } : false
});

async function audit() {
  console.log('='.repeat(70));
  console.log('TRAFFIC & FUNNEL QUALITY AUDIT');
  console.log('Generated:', new Date().toISOString());
  console.log('='.repeat(70));

  // =========================================================================
  // 1. TRAFFIC - Sessions, Users, Pageviews
  // =========================================================================
  console.log('\n\n📊 1. TRAFFIC OVERVIEW');
  console.log('-'.repeat(50));

  // Check analytics_sessions table
  try {
    const sessions30 = await pool.query(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_sessions
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);
    
    const sessions60 = await pool.query(`
      SELECT COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_sessions
      WHERE created_at > NOW() - INTERVAL '60 days'
    `);
    
    const sessions90 = await pool.query(`
      SELECT COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_sessions
      WHERE created_at > NOW() - INTERVAL '90 days'
    `);

    console.log('Sessions (analytics_sessions table):');
    console.log(`  30 days: ${sessions30.rows[0].unique_sessions}`);
    console.log(`  60 days: ${sessions60.rows[0].unique_sessions}`);
    console.log(`  90 days: ${sessions90.rows[0].unique_sessions}`);
  } catch (e) {
    console.log('  analytics_sessions error:', e.message);
  }

  // Check analytics_pageviews table
  try {
    const pv30 = await pool.query(`
      SELECT 
        COUNT(*) as total_pageviews,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_pageviews
      WHERE timestamp > NOW() - INTERVAL '30 days'
    `);
    
    const pv60 = await pool.query(`
      SELECT 
        COUNT(*) as total_pageviews,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_pageviews
      WHERE timestamp > NOW() - INTERVAL '60 days'
    `);
    
    const pv90 = await pool.query(`
      SELECT 
        COUNT(*) as total_pageviews,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_pageviews
      WHERE timestamp > NOW() - INTERVAL '90 days'
    `);

    console.log('\nPageviews (analytics_pageviews table):');
    console.log(`  30 days: ${pv30.rows[0].total_pageviews} pageviews, ${pv30.rows[0].unique_sessions} sessions`);
    console.log(`  60 days: ${pv60.rows[0].total_pageviews} pageviews, ${pv60.rows[0].unique_sessions} sessions`);
    console.log(`  90 days: ${pv90.rows[0].total_pageviews} pageviews, ${pv90.rows[0].unique_sessions} sessions`);
  } catch (e) {
    console.log('  analytics_pageviews error:', e.message);
  }

  // Product page views specifically
  try {
    const productViews = await pool.query(`
      SELECT 
        COUNT(*) as views,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_pageviews
      WHERE timestamp > NOW() - INTERVAL '30 days'
        AND (path LIKE '/wheels/%' OR path LIKE '/tires/%')
        AND path NOT LIKE '/wheels/for/%'
        AND path NOT LIKE '/tires/for/%'
    `);
    
    const srpViews = await pool.query(`
      SELECT 
        COUNT(*) as views,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_pageviews
      WHERE timestamp > NOW() - INTERVAL '30 days'
        AND (path LIKE '/wheels/for/%' OR path LIKE '/tires/for/%' OR path = '/wheels' OR path = '/tires')
    `);

    console.log('\nProduct Page Views (30 days):');
    console.log(`  Product Detail Pages (PDP): ${productViews.rows[0].views} views, ${productViews.rows[0].unique_sessions} sessions`);
    console.log(`  Search Results Pages (SRP): ${srpViews.rows[0].views} views, ${srpViews.rows[0].unique_sessions} sessions`);
  } catch (e) {
    console.log('  Product views error:', e.message);
  }

  // =========================================================================
  // 2. FUNNEL ANALYSIS
  // =========================================================================
  console.log('\n\n🔄 2. CONVERSION FUNNEL (Last 30 days)');
  console.log('-'.repeat(50));

  // Get funnel data from multiple sources
  let funnelData = {
    productViews: 0,
    addToCart: 0,
    cartViews: 0,
    beginCheckout: 0,
    orders: 0
  };

  // Product views from pageviews
  try {
    const pdpViews = await pool.query(`
      SELECT COUNT(DISTINCT session_id) as sessions
      FROM analytics_pageviews
      WHERE timestamp > NOW() - INTERVAL '30 days'
        AND (path LIKE '/wheels/%' OR path LIKE '/tires/%')
    `);
    funnelData.productViews = parseInt(pdpViews.rows[0].sessions) || 0;
  } catch (e) {}

  // Add to cart from cart_add_events
  try {
    const atc = await pool.query(`
      SELECT 
        COUNT(*) as events,
        COUNT(DISTINCT cart_id) as unique_carts
      FROM cart_add_events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND is_test = false
    `);
    funnelData.addToCart = parseInt(atc.rows[0].unique_carts) || 0;
  } catch (e) {}

  // Cart page views
  try {
    const cartViews = await pool.query(`
      SELECT COUNT(DISTINCT session_id) as sessions
      FROM analytics_pageviews
      WHERE timestamp > NOW() - INTERVAL '30 days'
        AND path = '/cart'
    `);
    funnelData.cartViews = parseInt(cartViews.rows[0].sessions) || 0;
  } catch (e) {}

  // Checkout page views (begin checkout)
  try {
    const checkoutViews = await pool.query(`
      SELECT COUNT(DISTINCT session_id) as sessions
      FROM analytics_pageviews
      WHERE timestamp > NOW() - INTERVAL '30 days'
        AND path = '/checkout'
    `);
    funnelData.beginCheckout = parseInt(checkoutViews.rows[0].sessions) || 0;
  } catch (e) {}

  // Orders
  try {
    const orders = await pool.query(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);
    funnelData.orders = parseInt(orders.rows[0].count) || 0;
  } catch (e) {}

  console.log('Funnel Stages:');
  console.log(`  1. Product Views (sessions):    ${funnelData.productViews}`);
  console.log(`  2. Add to Cart (unique carts):  ${funnelData.addToCart}`);
  console.log(`  3. Cart Page Views (sessions):  ${funnelData.cartViews}`);
  console.log(`  4. Checkout Page (sessions):    ${funnelData.beginCheckout}`);
  console.log(`  5. Orders Completed:            ${funnelData.orders}`);

  console.log('\nConversion Rates:');
  if (funnelData.productViews > 0) {
    console.log(`  Product View → Add to Cart:     ${((funnelData.addToCart / funnelData.productViews) * 100).toFixed(1)}%`);
  }
  if (funnelData.addToCart > 0) {
    console.log(`  Add to Cart → Cart View:        ${((funnelData.cartViews / funnelData.addToCart) * 100).toFixed(1)}%`);
    console.log(`  Add to Cart → Begin Checkout:   ${((funnelData.beginCheckout / funnelData.addToCart) * 100).toFixed(1)}%`);
    console.log(`  Add to Cart → Order:            ${((funnelData.orders / funnelData.addToCart) * 100).toFixed(1)}%`);
  }
  if (funnelData.beginCheckout > 0) {
    console.log(`  Begin Checkout → Order:         ${((funnelData.orders / funnelData.beginCheckout) * 100).toFixed(1)}%`);
  }

  // =========================================================================
  // 3. CART ABANDONMENT STAGES
  // =========================================================================
  console.log('\n\n🛒 3. CART ABANDONMENT STAGES');
  console.log('-'.repeat(50));

  // Analyze abandoned carts by stage
  try {
    const cartStages = await pool.query(`
      SELECT 
        CASE 
          WHEN customer_email IS NOT NULL AND customer_email != '' THEN 'has_email'
          ELSE 'no_email'
        END as email_status,
        CASE
          WHEN customer_first_name IS NOT NULL OR customer_last_name IS NOT NULL THEN 'has_name'
          ELSE 'no_name'
        END as name_status,
        COUNT(*) as count,
        SUM(estimated_total::numeric) as total_value
      FROM abandoned_carts
      WHERE is_test = false
        AND status IN ('abandoned', 'active')
        AND created_at > NOW() - INTERVAL '90 days'
      GROUP BY email_status, name_status
      ORDER BY count DESC
    `);

    console.log('Cart Stage Analysis (90 days):');
    let totalCarts = 0;
    let cartsWithEmail = 0;
    let cartsWithName = 0;
    let totalValue = 0;
    
    cartStages.rows.forEach(r => {
      const count = parseInt(r.count);
      const value = parseFloat(r.total_value) || 0;
      totalCarts += count;
      totalValue += value;
      if (r.email_status === 'has_email') cartsWithEmail += count;
      if (r.name_status === 'has_name') cartsWithName += count;
      console.log(`  ${r.email_status} + ${r.name_status}: ${count} carts ($${value.toFixed(0)})`);
    });

    console.log(`\nTotal Abandoned: ${totalCarts} carts ($${totalValue.toFixed(0)})`);
    console.log(`With Email: ${cartsWithEmail} (${((cartsWithEmail/totalCarts)*100).toFixed(1)}%)`);
    console.log(`Without Email: ${totalCarts - cartsWithEmail} (${(((totalCarts-cartsWithEmail)/totalCarts)*100).toFixed(1)}%)`);

  } catch (e) {
    console.log('  Cart stages error:', e.message);
  }

  // More detailed stage analysis
  try {
    const stageDetail = await pool.query(`
      SELECT 
        CASE 
          WHEN customer_email IS NULL OR customer_email = '' THEN 'A: No email (abandoned before checkout form)'
          WHEN (customer_first_name IS NULL AND customer_last_name IS NULL) THEN 'B: Email only (abandoned during checkout)'
          WHEN shipping_rate_failure IS NOT NULL THEN 'C: Shipping failed'
          ELSE 'D: Has contact info (abandoned late stage)'
        END as stage,
        COUNT(*) as count,
        SUM(estimated_total::numeric) as value
      FROM abandoned_carts
      WHERE is_test = false
        AND status IN ('abandoned', 'active')
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY stage
      ORDER BY stage
    `);

    console.log('\nAbandonment Stage (30 days):');
    stageDetail.rows.forEach(r => {
      console.log(`  ${r.stage}: ${r.count} carts ($${parseFloat(r.value || 0).toFixed(0)})`);
    });
  } catch (e) {
    // Column might not exist
  }

  // =========================================================================
  // 4. EMAIL COVERAGE ANALYSIS
  // =========================================================================
  console.log('\n\n📧 4. EMAIL COVERAGE');
  console.log('-'.repeat(50));

  const periods = [30, 60, 90];
  
  for (const days of periods) {
    try {
      const emailCoverage = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN customer_email IS NOT NULL AND customer_email != '' THEN 1 END) as with_email,
          SUM(estimated_total::numeric) as total_value,
          SUM(CASE WHEN customer_email IS NOT NULL AND customer_email != '' 
              THEN estimated_total::numeric ELSE 0 END) as value_with_email
        FROM abandoned_carts
        WHERE is_test = false
          AND created_at > NOW() - INTERVAL '${days} days'
      `);

      const r = emailCoverage.rows[0];
      const total = parseInt(r.total) || 0;
      const withEmail = parseInt(r.with_email) || 0;
      const withoutEmail = total - withEmail;
      const pct = total > 0 ? ((withEmail / total) * 100).toFixed(1) : 0;
      const totalVal = parseFloat(r.total_value) || 0;
      const valWithEmail = parseFloat(r.value_with_email) || 0;
      const valWithoutEmail = totalVal - valWithEmail;

      console.log(`\n${days} Days:`);
      console.log(`  Total Carts:     ${total}`);
      console.log(`  With Email:      ${withEmail} (${pct}%) — $${valWithEmail.toFixed(0)} recoverable`);
      console.log(`  Without Email:   ${withoutEmail} (${(100 - pct).toFixed(1)}%) — $${valWithoutEmail.toFixed(0)} LOST`);
    } catch (e) {
      console.log(`  ${days} days error:`, e.message);
    }
  }

  // =========================================================================
  // 5. DAILY TRENDS
  // =========================================================================
  console.log('\n\n📈 5. DAILY TRENDS (Last 14 days)');
  console.log('-'.repeat(50));

  try {
    const daily = await pool.query(`
      SELECT 
        DATE(ac.created_at) as date,
        COUNT(DISTINCT ac.cart_id) as carts,
        COUNT(DISTINCT CASE WHEN ac.customer_email IS NOT NULL AND ac.customer_email != '' 
              THEN ac.cart_id END) as carts_with_email,
        SUM(ac.estimated_total::numeric) as cart_value,
        COALESCE(o.orders, 0) as orders,
        COALESCE(o.revenue, 0) as revenue
      FROM abandoned_carts ac
      LEFT JOIN (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as orders,
          SUM(amount_paid_cents) / 100.0 as revenue
        FROM orders
        WHERE created_at > NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at)
      ) o ON DATE(ac.created_at) = o.date
      WHERE ac.is_test = false
        AND ac.created_at > NOW() - INTERVAL '14 days'
      GROUP BY DATE(ac.created_at), o.orders, o.revenue
      ORDER BY date DESC
    `);

    console.log('Date        | Carts | w/Email | Cart Value | Orders | Revenue');
    console.log('-'.repeat(65));
    daily.rows.forEach(r => {
      const date = r.date.toISOString().slice(0, 10);
      const carts = String(r.carts).padStart(5);
      const withEmail = String(r.carts_with_email).padStart(7);
      const cartVal = ('$' + parseFloat(r.cart_value || 0).toFixed(0)).padStart(10);
      const orders = String(r.orders).padStart(6);
      const revenue = ('$' + parseFloat(r.revenue || 0).toFixed(0)).padStart(8);
      console.log(`${date}  | ${carts} | ${withEmail} | ${cartVal} | ${orders} | ${revenue}`);
    });
  } catch (e) {
    console.log('  Daily trends error:', e.message);
  }

  // =========================================================================
  // 6. LOST REVENUE ANALYSIS
  // =========================================================================
  console.log('\n\n💰 6. LOST REVENUE ANALYSIS');
  console.log('-'.repeat(50));

  try {
    const lostRevenue = await pool.query(`
      SELECT 
        CASE 
          WHEN customer_email IS NULL OR customer_email = '' THEN 'No Email - Unrecoverable'
          ELSE 'Has Email - Recoverable'
        END as category,
        COUNT(*) as carts,
        SUM(estimated_total::numeric) as total_value,
        AVG(estimated_total::numeric) as avg_value
      FROM abandoned_carts
      WHERE is_test = false
        AND status IN ('abandoned', 'active')
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY category
    `);

    console.log('30-Day Abandoned Cart Value:');
    let totalLost = 0;
    let recoverableLost = 0;
    
    lostRevenue.rows.forEach(r => {
      const value = parseFloat(r.total_value) || 0;
      totalLost += value;
      if (r.category.includes('Recoverable')) recoverableLost = value;
      console.log(`  ${r.category}:`);
      console.log(`    Carts: ${r.carts}, Value: $${value.toFixed(0)}, Avg: $${parseFloat(r.avg_value || 0).toFixed(0)}`);
    });

    console.log(`\nTotal Lost Revenue (30d): $${totalLost.toFixed(0)}`);
    console.log(`Recoverable (has email): $${recoverableLost.toFixed(0)}`);
    console.log(`Unrecoverable (no email): $${(totalLost - recoverableLost).toFixed(0)}`);

    // If we could capture 50% more emails
    const emailCaptureRate = recoverableLost / totalLost;
    const potentialRecovery = totalLost * 0.1; // 10% recovery rate
    console.log(`\nIf email capture improved from ${(emailCaptureRate * 100).toFixed(0)}% to 50%:`);
    console.log(`  Additional recoverable: $${((totalLost * 0.5) - recoverableLost).toFixed(0)}/month`);

  } catch (e) {
    console.log('  Lost revenue error:', e.message);
  }

  // =========================================================================
  // SUMMARY & RECOMMENDATIONS
  // =========================================================================
  console.log('\n\n' + '='.repeat(70));
  console.log('SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(70));

  await pool.end();
}

audit().catch(console.error);
