import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check pageviews for checkout
  const { rows: pvs } = await pool.query(`
    SELECT path, COUNT(*)::int as count, MAX(timestamp) as last_seen
    FROM analytics_pageviews
    WHERE path LIKE '%checkout%'
    AND timestamp > NOW() - INTERVAL '7 days'
    GROUP BY path
    ORDER BY count DESC
    LIMIT 20
  `);
  
  console.log('=== Checkout Page Views (7 days) ===');
  if (pvs.length === 0) {
    console.log('  (no checkout pageviews found)');
  } else {
    pvs.forEach(r => {
      console.log(`${r.count.toString().padStart(4)} | ${r.path.slice(0, 60)} | ${r.last_seen?.toISOString().slice(0,16)}`);
    });
  }
  
  // Check for any multi-page sessions that reached checkout
  const { rows: multiPage } = await pool.query(`
    SELECT s.session_id, s.page_view_count, s.current_page, s.landing_page
    FROM analytics_sessions s
    WHERE s.is_test = false
    AND s.page_view_count > 3
    AND s.first_seen_at > NOW() - INTERVAL '48 hours'
    ORDER BY s.page_view_count DESC
    LIMIT 15
  `);
  
  console.log('\n=== Multi-page Sessions (>3 pages, 48h) ===');
  multiPage.forEach(r => {
    console.log(`${r.page_view_count} pages | current: ${r.current_page?.slice(0,50)} | landed: ${r.landing_page?.slice(0,30)}`);
  });
  
  // Check if pageviews table has checkout
  const { rows: checkoutPvs } = await pool.query(`
    SELECT pv.session_id, pv.path, pv.timestamp
    FROM analytics_pageviews pv
    WHERE pv.path LIKE '%checkout%'
    AND pv.timestamp > NOW() - INTERVAL '7 days'
    ORDER BY pv.timestamp DESC
    LIMIT 10
  `);
  
  console.log('\n=== Recent Checkout Pageviews (7 days) ===');
  if (checkoutPvs.length === 0) {
    console.log('  (no checkout pageviews!)');
  } else {
    checkoutPvs.forEach(r => {
      console.log(`${r.session_id?.slice(0,20)}... | ${r.path} | ${r.timestamp?.toISOString()}`);
    });
  }
  
  // Total pageviews
  const { rows: totals } = await pool.query(`
    SELECT 
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours')::int as last_24h,
      COUNT(DISTINCT session_id)::int as unique_sessions
    FROM analytics_pageviews
    WHERE timestamp > NOW() - INTERVAL '7 days'
  `);
  console.log(`\nPageviews (7 days): ${totals[0].total}, Last 24h: ${totals[0].last_24h}, Sessions: ${totals[0].unique_sessions}`);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
