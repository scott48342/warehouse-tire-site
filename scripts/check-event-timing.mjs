import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Get real funnel events with timestamps
  const { rows: events } = await pool.query(`
    SELECT event_name, session_id, created_at, cart_value
    FROM funnel_events
    WHERE session_id NOT LIKE 'sample-%'
    ORDER BY created_at DESC
    LIMIT 30
  `);
  
  console.log('=== REAL Funnel Events (most recent) ===\n');
  events.forEach(r => {
    const time = r.created_at?.toISOString().slice(11,19);
    const date = r.created_at?.toISOString().slice(0,10);
    console.log(`${date} ${time} | ${r.event_name.padEnd(25)} | ${r.session_id.slice(0,20)}... | $${r.cart_value || 0}`);
  });
  
  // Check when funnel tracking was deployed (first real event)
  const { rows: first } = await pool.query(`
    SELECT MIN(created_at) as first, MAX(created_at) as last, COUNT(*)::int as count
    FROM funnel_events
    WHERE session_id NOT LIKE 'sample-%'
  `);
  console.log(`\nFirst real event: ${first[0].first?.toISOString()}`);
  console.log(`Last real event:  ${first[0].last?.toISOString()}`);
  console.log(`Total real events: ${first[0].count}`);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
