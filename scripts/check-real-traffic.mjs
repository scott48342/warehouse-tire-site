import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check REAL funnel events (exclude sample-* sessions)
  const { rows: funnel } = await pool.query(`
    SELECT event_name, COUNT(*)::int as count
    FROM funnel_events
    WHERE created_at > NOW() - INTERVAL '24 hours'
    AND session_id NOT LIKE 'sample-%'
    GROUP BY event_name
    ORDER BY count DESC
  `);
  
  console.log('=== REAL Funnel Events (Last 24h, excluding sample-*) ===');
  if (funnel.length === 0) {
    console.log('  (no real traffic found!)');
  } else {
    funnel.forEach(r => {
      console.log(`${r.event_name.padEnd(25)}: ${r.count}`);
    });
  }
  
  // Check for REAL add_to_cart events
  const { rows: cartEvents } = await pool.query(`
    SELECT session_id, COUNT(*)::int as adds, MAX(created_at) as last_add, MAX(cart_value) as value
    FROM funnel_events
    WHERE event_name = 'add_to_cart'
    AND created_at > NOW() - INTERVAL '48 hours'
    AND session_id NOT LIKE 'sample-%'
    GROUP BY session_id
    ORDER BY last_add DESC
    LIMIT 10
  `);
  
  console.log('\n=== REAL Add-to-Cart Sessions (Last 48h) ===');
  if (cartEvents.length === 0) {
    console.log('  (no real add-to-cart found!)');
  } else {
    cartEvents.forEach(r => {
      console.log(`${r.session_id.slice(0,25)}... | ${r.adds} adds | $${r.value || 0} | ${r.last_add?.toISOString().slice(0,16)}`);
    });
  }
  
  // Count real vs sample
  const { rows: comparison } = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE session_id LIKE 'sample-%')::int as sample_events,
      COUNT(*) FILTER (WHERE session_id NOT LIKE 'sample-%')::int as real_events
    FROM funnel_events
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);
  
  console.log('\n=== Sample vs Real (24h) ===');
  console.log(`Sample events: ${comparison[0].sample_events}`);
  console.log(`Real events:   ${comparison[0].real_events}`);
  
  // Check if funnel tracking was recently deployed
  const { rows: firstReal } = await pool.query(`
    SELECT MIN(created_at) as first_event
    FROM funnel_events
    WHERE session_id NOT LIKE 'sample-%'
  `);
  console.log(`\nFirst real funnel event: ${firstReal[0].first_event?.toISOString() || 'none'}`);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
