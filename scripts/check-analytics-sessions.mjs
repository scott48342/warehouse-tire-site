import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check if analytics_sessions table exists
  const { rows: tables } = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name = 'analytics_sessions'
  `);
  
  if (tables.length === 0) {
    console.log('❌ analytics_sessions table does NOT exist!');
    console.log('This table needs to be created for session history to work.');
    await pool.end();
    return;
  }
  
  console.log('✅ analytics_sessions table exists');
  
  // Get counts
  const { rows: counts } = await pool.query(`
    SELECT 
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE first_seen_at > NOW() - INTERVAL '24 hours')::int as last_24h,
      COUNT(*) FILTER (WHERE first_seen_at > NOW() - INTERVAL '1 hour')::int as last_1h,
      COUNT(*) FILTER (WHERE is_test = false)::int as real_sessions,
      COUNT(*) FILTER (WHERE is_test = true)::int as test_sessions
    FROM analytics_sessions
  `);
  
  console.log('\n=== Session Counts ===');
  console.log(`Total:        ${counts[0].total}`);
  console.log(`Last 24h:     ${counts[0].last_24h}`);
  console.log(`Last 1h:      ${counts[0].last_1h}`);
  console.log(`Real:         ${counts[0].real_sessions}`);
  console.log(`Test:         ${counts[0].test_sessions}`);
  
  // Recent sessions with checkout
  const { rows: recent } = await pool.query(`
    SELECT session_id, current_page, page_view_count, first_seen_at, last_seen_at, hostname
    FROM analytics_sessions
    WHERE is_test = false
    AND first_seen_at > NOW() - INTERVAL '24 hours'
    ORDER BY last_seen_at DESC
    LIMIT 10
  `);
  
  console.log('\n=== Recent REAL Sessions (24h) ===');
  if (recent.length === 0) {
    console.log('  (no real sessions found)');
  } else {
    recent.forEach(r => {
      const page = r.current_page?.slice(0, 40) || 'unknown';
      console.log(`${r.session_id?.slice(0,15)}... | ${r.page_view_count} pages | ${page}`);
    });
  }
  
  // Check for checkout page visits
  const { rows: checkouts } = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM analytics_sessions
    WHERE is_test = false
    AND current_page LIKE '%checkout%'
    AND first_seen_at > NOW() - INTERVAL '24 hours'
  `);
  
  console.log(`\nSessions on checkout page (24h): ${checkouts[0].count}`);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
