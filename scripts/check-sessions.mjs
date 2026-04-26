import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check if session_activity table exists
  const { rows: tables } = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name IN ('session_activity', 'sessions', 'visitor_sessions')
  `);
  console.log('=== Session Tables Found ===');
  console.log(tables.map(t => t.table_name).join(', ') || 'none');
  
  // Try to find the session table
  for (const tableName of ['session_activity', 'sessions', 'visitor_sessions']) {
    try {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int as count FROM ${tableName}
      `);
      console.log(`\n${tableName}: ${rows[0].count} rows`);
      
      // Get recent sessions
      const { rows: recent } = await pool.query(`
        SELECT * FROM ${tableName} 
        ORDER BY created_at DESC LIMIT 5
      `);
      if (recent.length > 0) {
        console.log('Columns:', Object.keys(recent[0]).join(', '));
        console.log('Sample:', JSON.stringify(recent[0], null, 2).slice(0, 500));
      }
    } catch (e) {
      // Table doesn't exist
    }
  }
  
  // Check live_visitors table
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int as count,
             COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '30 minutes')::int as active30m
      FROM live_visitors
    `);
    console.log(`\nlive_visitors: ${rows[0].count} total, ${rows[0].active30m} active in 30m`);
    
    // Recent live visitors
    const { rows: recent } = await pool.query(`
      SELECT session_id, current_page, last_seen, checkout_started, cart_value
      FROM live_visitors
      WHERE last_seen > NOW() - INTERVAL '24 hours'
      ORDER BY last_seen DESC
      LIMIT 10
    `);
    console.log('\nRecent live visitors (24h):');
    recent.forEach(r => {
      console.log(`  ${r.session_id?.slice(0,15)}... | ${r.current_page?.slice(0,30)} | checkout=${r.checkout_started} | $${r.cart_value || 0}`);
    });
  } catch (e) {
    console.log('live_visitors table error:', e.message);
  }
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
