/**
 * Analytics Before/After Wheel Search Fix (dc2d613)
 * Deployed approximately 2026-05-12 15:20 EST
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function analyze() {
  console.log('='.repeat(70));
  console.log('ANALYTICS: Wheel Search Fix Before/After');
  console.log('Fix deployed: 2026-05-12 ~15:20 EST (commit dc2d613)');
  console.log('='.repeat(70));
  console.log('');

  // Check if tables exist
  const tablesCheck = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('unresolved_fitment_searches', 'analytics_events', 'page_views', 'site_visits')
  `);
  console.log('Available tables:', tablesCheck.rows.map(r => r.table_name).join(', '));
  console.log('');

  // Unresolved fitment searches - before vs after
  console.log('--- UNRESOLVED FITMENT SEARCHES ---');
  
  // Today's unresolved searches
  const unresolvedToday = await pool.query(`
    SELECT 
      DATE(last_seen AT TIME ZONE 'America/New_York') as date,
      COUNT(*) as unique_ymm,
      SUM(occurrence_count) as total_searches,
      search_type
    FROM unresolved_fitment_searches
    WHERE last_seen >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(last_seen AT TIME ZONE 'America/New_York'), search_type
    ORDER BY date DESC, search_type
  `);
  
  console.log('\nUnresolved searches by day (last 7 days):');
  console.log('Date       | Type  | Unique YMM | Total Searches');
  console.log('-'.repeat(50));
  unresolvedToday.rows.forEach(r => {
    const date = r.date?.toISOString().split('T')[0] || 'N/A';
    console.log(`${date} | ${r.search_type?.padEnd(5)} | ${String(r.unique_ymm).padStart(10)} | ${r.total_searches}`);
  });

  // Unresolved searches in last 2 hours (after fix)
  const unresolvedRecent = await pool.query(`
    SELECT year, make, model, occurrence_count, last_seen
    FROM unresolved_fitment_searches
    WHERE last_seen >= NOW() - INTERVAL '2 hours'
    AND search_type = 'wheel'
    ORDER BY occurrence_count DESC
    LIMIT 10
  `);
  
  console.log('\nWheel searches unresolved in LAST 2 HOURS (should be few/none):');
  if (unresolvedRecent.rows.length === 0) {
    console.log('✅ None! This is good - fix is working.');
  } else {
    unresolvedRecent.rows.forEach(r => {
      console.log(`  ${r.year} ${r.make} ${r.model} - ${r.occurrence_count} searches`);
    });
  }

  // Check analytics events table
  console.log('\n--- ANALYTICS EVENTS ---');
  const eventsCheck = await pool.query(`
    SELECT 
      event_type,
      COUNT(*) as count,
      DATE(created_at AT TIME ZONE 'America/New_York') as date
    FROM analytics_events
    WHERE created_at >= NOW() - INTERVAL '7 days'
    AND event_type IN ('wheel_search', 'wheel_srp_view', 'add_to_cart', 'package_start', 'checkout_start', 'no_fitment_data')
    GROUP BY event_type, DATE(created_at AT TIME ZONE 'America/New_York')
    ORDER BY date DESC, event_type
  `).catch(() => ({ rows: [] }));

  if (eventsCheck.rows.length > 0) {
    console.log('Event counts by day:');
    eventsCheck.rows.forEach(r => {
      const date = r.date?.toISOString().split('T')[0] || 'N/A';
      console.log(`  ${date} | ${r.event_type}: ${r.count}`);
    });
  } else {
    console.log('(analytics_events table empty or not tracking these events)');
  }

  // Check page views
  console.log('\n--- PAGE VIEWS ---');
  const pageViews = await pool.query(`
    SELECT 
      DATE(timestamp AT TIME ZONE 'America/New_York') as date,
      COUNT(*) as views,
      COUNT(DISTINCT session_id) as sessions
    FROM page_views
    WHERE timestamp >= NOW() - INTERVAL '7 days'
    AND path LIKE '/wheels%'
    GROUP BY DATE(timestamp AT TIME ZONE 'America/New_York')
    ORDER BY date DESC
  `).catch(() => ({ rows: [] }));

  if (pageViews.rows.length > 0) {
    console.log('Wheel page views by day:');
    pageViews.rows.forEach(r => {
      const date = r.date?.toISOString().split('T')[0] || 'N/A';
      console.log(`  ${date}: ${r.views} views, ${r.sessions} sessions`);
    });
  } else {
    console.log('(page_views table empty or not available)');
  }

  // Site visits
  console.log('\n--- SITE VISITS ---');
  const visits = await pool.query(`
    SELECT 
      DATE(start_time AT TIME ZONE 'America/New_York') as date,
      COUNT(*) as visits,
      domain
    FROM site_visits
    WHERE start_time >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(start_time AT TIME ZONE 'America/New_York'), domain
    ORDER BY date DESC, domain
  `).catch(() => ({ rows: [] }));

  if (visits.rows.length > 0) {
    console.log('Site visits by day:');
    visits.rows.forEach(r => {
      const date = r.date?.toISOString().split('T')[0] || 'N/A';
      console.log(`  ${date} | ${r.domain || 'unknown'}: ${r.visits} visits`);
    });
  } else {
    console.log('(site_visits table empty or not available)');
  }

  // Most commonly unresolved before fix (for context)
  console.log('\n--- TOP PREVIOUSLY UNRESOLVED (historical) ---');
  const topUnresolved = await pool.query(`
    SELECT year, make, model, occurrence_count, last_seen, search_type
    FROM unresolved_fitment_searches
    WHERE search_type = 'wheel'
    ORDER BY occurrence_count DESC
    LIMIT 15
  `);
  
  console.log('Most searched vehicles that were previously unresolved:');
  topUnresolved.rows.forEach(r => {
    const lastSeen = r.last_seen ? new Date(r.last_seen).toISOString().replace('T', ' ').slice(0, 16) : 'N/A';
    console.log(`  ${r.year} ${r.make} ${r.model} - ${r.occurrence_count}x (last: ${lastSeen})`);
  });

  await pool.end();
  console.log('\n' + '='.repeat(70));
}

analyze().catch(e => { console.error(e); process.exit(1); });
