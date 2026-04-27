/**
 * Funnel Events Verification Script
 * 
 * Run this after testing the site to verify events reached the database.
 * 
 * Usage: node scripts/verify-funnel-events.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60 * 1000).toISOString();

console.log('=== FUNNEL EVENT VERIFICATION ===');
console.log(`Checking events since: ${FIVE_MIN_AGO}\n`);

// Check recent events by type
const events = await pool.query(`
  SELECT 
    event_name,
    COUNT(*) as count,
    MAX(created_at) as last_seen
  FROM funnel_events
  WHERE created_at > $1
  GROUP BY event_name
  ORDER BY last_seen DESC
`, [FIVE_MIN_AGO]);

if (events.rows.length === 0) {
  console.log('❌ No events found in last 5 minutes');
  console.log('\nTo test:');
  console.log('1. Visit a tire PDP (e.g., /tires/[sku])');
  console.log('2. Add to cart');
  console.log('3. Go to checkout');
  console.log('4. Run this script again');
} else {
  console.log('Recent events:');
  events.rows.forEach(r => {
    const time = new Date(r.last_seen).toLocaleTimeString();
    const status = r.count > 0 ? '✅' : '❌';
    console.log(`  ${status} ${r.event_name}: ${r.count} (last: ${time})`);
  });
}

// Check for specific expected events
console.log('\n--- Expected Event Checklist ---');

const checklist = [
  'session_start',
  'product_view',
  'add_to_cart',
  'begin_checkout',
  'first_order_coupon_applied',
];

for (const event of checklist) {
  const result = await pool.query(`
    SELECT COUNT(*) as count FROM funnel_events
    WHERE event_name = $1 AND created_at > $2
  `, [event, FIVE_MIN_AGO]);
  
  const count = parseInt(result.rows[0].count);
  const status = count > 0 ? '✅' : '⬜';
  console.log(`${status} ${event}: ${count}`);
}

// Show last 10 events
console.log('\n--- Last 10 Events ---');
const recent = await pool.query(`
  SELECT event_name, session_id, page_url, created_at
  FROM funnel_events
  ORDER BY created_at DESC
  LIMIT 10
`);

recent.rows.forEach(r => {
  const time = new Date(r.created_at).toLocaleTimeString();
  const path = r.page_url ? new URL(r.page_url).pathname.slice(0, 35) : '-';
  console.log(`  ${time} | ${r.event_name.padEnd(25)} | ${path}`);
});

await pool.end();
console.log('\n=== VERIFICATION COMPLETE ===');
