import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check funnel events today
  const { rows: funnel } = await pool.query(`
    SELECT event_name, COUNT(*)::int as count
    FROM funnel_events
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY event_name
    ORDER BY count DESC
  `);
  
  console.log('=== Funnel Events (Last 24h) ===');
  funnel.forEach(r => {
    console.log(`${r.event_name.padEnd(25)}: ${r.count}`);
  });
  
  // Check for add_to_cart events
  const { rows: cartEvents } = await pool.query(`
    SELECT session_id, COUNT(*)::int as adds, MAX(created_at) as last_add
    FROM funnel_events
    WHERE event_name = 'add_to_cart'
    AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY session_id
    ORDER BY last_add DESC
    LIMIT 10
  `);
  
  console.log('\n=== Recent Add-to-Cart Sessions ===');
  cartEvents.forEach(r => {
    console.log(`${r.session_id.slice(0,20)}... | ${r.adds} adds | ${r.last_add?.toISOString().slice(11,16)}`);
  });
  
  // Check begin_checkout events
  const { rows: checkouts } = await pool.query(`
    SELECT session_id, created_at, cart_value
    FROM funnel_events
    WHERE event_name = 'begin_checkout'
    AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  
  console.log('\n=== Begin Checkout Events (24h) ===');
  checkouts.forEach(r => {
    console.log(`${r.session_id.slice(0,20)}... | $${r.cart_value || 0} | ${r.created_at?.toISOString().slice(11,16)}`);
  });
  
  // Compare to sessions in session_activity
  const { rows: sessions } = await pool.query(`
    SELECT COUNT(DISTINCT session_id)::int as unique_sessions
    FROM funnel_events
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);
  console.log(`\nUnique sessions (24h): ${sessions[0].unique_sessions}`);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
