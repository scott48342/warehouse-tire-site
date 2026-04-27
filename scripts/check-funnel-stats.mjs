import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

// First event ever
const first = await pool.query('SELECT MIN(created_at) as first_event FROM funnel_events');
console.log('First event recorded:', first.rows[0].first_event);

// Total sessions all time
const total = await pool.query('SELECT COUNT(DISTINCT session_id) as sessions FROM funnel_events');
console.log('Total sessions (all time):', total.rows[0].sessions);

// Sessions by day (last 10 days)
const byDay = await pool.query(`
  SELECT DATE(created_at) as day, COUNT(DISTINCT session_id) as sessions 
  FROM funnel_events 
  GROUP BY DATE(created_at) 
  ORDER BY day DESC 
  LIMIT 10
`);
console.log('\nSessions by day:');
byDay.rows.forEach(r => console.log(r.day?.toISOString().slice(0,10), ':', r.sessions, 'sessions'));

await pool.end();
