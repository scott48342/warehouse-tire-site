import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // Check funnel_events structure
    console.log('=== FUNNEL_EVENTS COLUMNS ===');
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'funnel_events'
      ORDER BY ordinal_position
    `);
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    // Sample recent data
    console.log('\n=== RECENT FUNNEL EVENTS (last 5) ===');
    const recent = await client.query(`
      SELECT session_id, event_name, page_url, created_at 
      FROM funnel_events 
      WHERE created_at > NOW() - INTERVAL '6 hours'
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    recent.rows.forEach(r => {
      console.log(`  ${r.event_name}: ${r.page_url || '(null)'}`);
    });
    
    // Check analytics_pageviews for comparison
    console.log('\n=== ANALYTICS_PAGEVIEWS (last 5) ===');
    const pageviews = await client.query(`
      SELECT session_id, path, timestamp, hostname
      FROM analytics_pageviews 
      ORDER BY timestamp DESC 
      LIMIT 5
    `);
    pageviews.rows.forEach(r => {
      console.log(`  ${r.path} (${r.hostname || 'no host'})`);
    });
    
    // Count records in each table
    console.log('\n=== RECORD COUNTS (last 24h) ===');
    const funnel = await client.query(`SELECT COUNT(*) as cnt FROM funnel_events WHERE created_at > NOW() - INTERVAL '24 hours'`);
    const analytics = await client.query(`SELECT COUNT(*) as cnt FROM analytics_pageviews WHERE timestamp > NOW() - INTERVAL '24 hours'`);
    console.log(`  funnel_events: ${funnel.rows[0].cnt}`);
    console.log(`  analytics_pageviews: ${analytics.rows[0].cnt}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
