import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check recent carts
  const { rows: recent } = await pool.query(`
    SELECT cart_id, status, item_count, estimated_total, customer_email, 
           created_at, last_activity_at, is_test
    FROM abandoned_carts 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  
  console.log('=== Last 10 Carts ===');
  recent.forEach(r => {
    const cartIdShort = r.cart_id ? r.cart_id.slice(0,12) : 'null';
    const email = r.customer_email || 'no email';
    const created = r.created_at ? r.created_at.toISOString().slice(0,16) : 'null';
    console.log(`${cartIdShort}... | ${String(r.status).padEnd(10)} | ${r.item_count} items | $${r.estimated_total} | ${email} | ${created} | test=${r.is_test}`);
  });
  
  // Check counts by status
  const { rows: counts } = await pool.query(`
    SELECT status, COUNT(*)::int as count, 
           MIN(created_at)::date as oldest,
           MAX(created_at)::date as newest
    FROM abandoned_carts
    GROUP BY status
    ORDER BY count DESC
  `);
  
  console.log('\n=== Status Counts ===');
  counts.forEach(r => {
    console.log(`${String(r.status).padEnd(12)}: ${r.count} (oldest: ${r.oldest}, newest: ${r.newest})`);
  });
  
  // Check for recent activity (last 24 hours)
  const { rows: recent24h } = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM abandoned_carts
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);
  console.log(`\nCarts created in last 24 hours: ${recent24h[0].count}`);
  
  // Check for active carts
  const { rows: active } = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM abandoned_carts
    WHERE status = 'active'
    AND last_activity_at > NOW() - INTERVAL '1 hour'
  `);
  console.log(`Active carts (activity < 1hr): ${active[0].count}`);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
