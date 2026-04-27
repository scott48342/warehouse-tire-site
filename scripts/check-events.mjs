import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

const result = await pool.query(`
  SELECT event_name, session_id, traffic_source, store_mode, created_at 
  FROM funnel_events 
  ORDER BY created_at DESC 
  LIMIT 20
`);

console.log('Recent funnel events:');
result.rows.forEach(row => {
  const time = row.created_at?.toISOString().slice(0,19).replace('T', ' ');
  console.log(`${time} | ${row.event_name.padEnd(15)} | ${(row.traffic_source || 'direct').padEnd(12)} | ${row.store_mode}`);
});

await pool.end();
