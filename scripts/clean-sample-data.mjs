import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function clean() {
  // Check sample data
  const { rows: before } = await pool.query(`
    SELECT COUNT(*)::int as count FROM funnel_events WHERE session_id LIKE 'sample-%'
  `);
  console.log('Sample events to delete:', before[0].count);
  
  // Delete sample data
  const result = await pool.query(`
    DELETE FROM funnel_events WHERE session_id LIKE 'sample-%'
  `);
  console.log('Deleted:', result.rowCount);
  
  // Verify
  const { rows: after } = await pool.query(`
    SELECT event_name, COUNT(*)::int as count 
    FROM funnel_events 
    GROUP BY event_name 
    ORDER BY count DESC
  `);
  console.log('\nRemaining REAL events:');
  after.forEach(r => console.log('  ' + r.event_name + ': ' + r.count));
  
  await pool.end();
}

clean().catch(e => { console.error(e); process.exit(1); });
