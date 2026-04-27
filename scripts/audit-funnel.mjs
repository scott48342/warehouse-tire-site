import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

console.log('=== FUNNEL EVENTS AUDIT ===\n');

// 1. Event counts by type
console.log('1. EVENT COUNTS BY TYPE');
const eventCounts = await pool.query(`
  SELECT event_name, COUNT(*) as count
  FROM funnel_events
  GROUP BY event_name
  ORDER BY count DESC
`);
eventCounts.rows.forEach(r => console.log(`   ${r.event_name}: ${r.count}`));

// 2. Session vs event breakdown
console.log('\n2. SESSIONS WITH SPECIFIC EVENTS');
const sessionBreakdown = await pool.query(`
  SELECT 
    COUNT(DISTINCT session_id) as total_sessions,
    COUNT(DISTINCT CASE WHEN event_name = 'session_start' THEN session_id END) as with_session_start,
    COUNT(DISTINCT CASE WHEN event_name = 'product_view' THEN session_id END) as with_product_view,
    COUNT(DISTINCT CASE WHEN event_name = 'add_to_cart' THEN session_id END) as with_add_to_cart,
    COUNT(DISTINCT CASE WHEN event_name = 'begin_checkout' THEN session_id END) as with_begin_checkout,
    COUNT(DISTINCT CASE WHEN event_name = 'first_order_popup_shown' THEN session_id END) as with_popup_shown,
    COUNT(DISTINCT CASE WHEN event_name = 'first_order_popup_submit' THEN session_id END) as with_popup_submit,
    COUNT(DISTINCT CASE WHEN event_name = 'first_order_coupon_applied' THEN session_id END) as with_coupon_applied
  FROM funnel_events
`);
const sb = sessionBreakdown.rows[0];
console.log(`   Total sessions: ${sb.total_sessions}`);
console.log(`   With session_start: ${sb.with_session_start}`);
console.log(`   With product_view: ${sb.with_product_view}`);
console.log(`   With add_to_cart: ${sb.with_add_to_cart}`);
console.log(`   With begin_checkout: ${sb.with_begin_checkout}`);
console.log(`   With popup_shown: ${sb.with_popup_shown}`);
console.log(`   With popup_submit: ${sb.with_popup_submit}`);
console.log(`   With coupon_applied: ${sb.with_coupon_applied}`);

// 3. Check for sessions WITHOUT session_start (indicates problem)
console.log('\n3. SESSIONS MISSING session_start EVENT');
const missingStart = await pool.query(`
  SELECT session_id, MIN(event_name) as first_event, MIN(created_at) as first_time
  FROM funnel_events
  WHERE session_id NOT IN (
    SELECT DISTINCT session_id FROM funnel_events WHERE event_name = 'session_start'
  )
  GROUP BY session_id
  LIMIT 10
`);
console.log(`   Found ${missingStart.rows.length} sessions without session_start`);
missingStart.rows.forEach(r => console.log(`   - ${r.session_id?.slice(0,12)}... first event: ${r.first_event}`));

// 4. Product view analysis
console.log('\n4. PRODUCT_VIEW ANALYSIS');
const productViews = await pool.query(`
  SELECT page_url, product_sku, product_type, created_at
  FROM funnel_events
  WHERE event_name = 'product_view'
  ORDER BY created_at DESC
  LIMIT 10
`);
console.log(`   Total product_view events: ${productViews.rows.length} (showing last 10)`);
productViews.rows.forEach(r => {
  const path = r.page_url ? new URL(r.page_url).pathname.slice(0,50) : 'no-url';
  console.log(`   - ${r.product_type || 'unknown'} | ${r.product_sku || 'no-sku'} | ${path}`);
});

// 5. Check page URLs that SHOULD have product_view but don't
console.log('\n5. SESSIONS VISITING PDP PAGES');
const pdpVisits = await pool.query(`
  SELECT DISTINCT session_id, page_url
  FROM funnel_events
  WHERE page_url LIKE '%/wheels/%' 
     OR page_url LIKE '%/tires/%'
     OR page_url LIKE '%/wheel/%'
     OR page_url LIKE '%/tire/%'
  LIMIT 20
`);
console.log(`   Sessions visiting wheel/tire pages: ${pdpVisits.rows.length}`);
pdpVisits.rows.slice(0,5).forEach(r => {
  const path = r.page_url ? new URL(r.page_url).pathname.slice(0,60) : 'no-url';
  console.log(`   - ${path}`);
});

// 6. Coupon flow analysis
console.log('\n6. COUPON FLOW ANALYSIS');
const couponFlow = await pool.query(`
  SELECT event_name, session_id, coupon_code, created_at
  FROM funnel_events
  WHERE event_name IN ('first_order_popup_shown', 'first_order_popup_submit', 'first_order_coupon_applied')
  ORDER BY created_at DESC
`);
console.log(`   Coupon-related events:`);
couponFlow.rows.forEach(r => {
  console.log(`   - ${r.event_name} | session: ${r.session_id?.slice(0,10)}... | code: ${r.coupon_code || 'n/a'}`);
});

// 7. Check traffic sources
console.log('\n7. TRAFFIC SOURCE BREAKDOWN');
const sources = await pool.query(`
  SELECT traffic_source, COUNT(DISTINCT session_id) as sessions
  FROM funnel_events
  GROUP BY traffic_source
  ORDER BY sessions DESC
`);
sources.rows.forEach(r => console.log(`   ${r.traffic_source || 'null'}: ${r.sessions} sessions`));

// 8. Device type breakdown
console.log('\n8. DEVICE TYPE BREAKDOWN');
const devices = await pool.query(`
  SELECT device_type, COUNT(DISTINCT session_id) as sessions
  FROM funnel_events
  GROUP BY device_type
  ORDER BY sessions DESC
`);
devices.rows.forEach(r => console.log(`   ${r.device_type || 'null'}: ${r.sessions} sessions`));

// 9. Check for potential test/internal traffic
console.log('\n9. POTENTIAL INTERNAL TRAFFIC');
const internal = await pool.query(`
  SELECT session_id, COUNT(*) as events, 
         MIN(page_url) as first_url,
         array_agg(DISTINCT event_name) as event_types
  FROM funnel_events
  WHERE page_url LIKE '%localhost%' 
     OR page_url LIKE '%/admin%'
     OR traffic_source = 'direct'
  GROUP BY session_id
  HAVING COUNT(*) > 5
  LIMIT 10
`);
console.log(`   High-activity direct/localhost sessions: ${internal.rows.length}`);

// 10. Recent events timeline
console.log('\n10. RECENT EVENTS TIMELINE (last 20)');
const recent = await pool.query(`
  SELECT event_name, session_id, page_url, created_at
  FROM funnel_events
  ORDER BY created_at DESC
  LIMIT 20
`);
recent.rows.forEach(r => {
  const time = r.created_at?.toISOString().slice(11,19);
  const path = r.page_url ? new URL(r.page_url).pathname.slice(0,40) : 'no-url';
  console.log(`   ${time} | ${r.event_name.padEnd(25)} | ${path}`);
});

await pool.end();
console.log('\n=== AUDIT COMPLETE ===');
