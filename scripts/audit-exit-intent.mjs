import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
const { Pool } = pg;

const url = process.env.POSTGRES_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url?.includes('neon') || url?.includes('prisma') ? { rejectUnauthorized: false } : undefined
});

async function main() {
  console.log('=== EXIT INTENT EMAIL CAPTURE AUDIT ===\n');

  // 1. Check if email_subscribers table exists and schema
  console.log('--- 1. EMAIL SUBSCRIBERS TABLE ---');
  const tableCheck = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'email_subscribers'
    ORDER BY ordinal_position
  `);
  if (tableCheck.rows.length === 0) {
    console.log('❌ Table email_subscribers does NOT exist!');
  } else {
    console.log('✅ Table exists. Schema:');
    for (const col of tableCheck.rows) {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    }
  }

  // 2. Count total subscribers
  console.log('\n--- 2. SUBSCRIBER COUNTS ---');
  try {
    const total = await pool.query(`SELECT COUNT(*) as cnt FROM email_subscribers`);
    console.log(`Total subscribers: ${total.rows[0].cnt}`);

    // By source
    const bySrc = await pool.query(`
      SELECT source, COUNT(*) as cnt, COUNT(CASE WHEN is_test THEN 1 END) as test_cnt
      FROM email_subscribers 
      GROUP BY source
      ORDER BY cnt DESC
    `);
    console.log('\nBy source:');
    for (const r of bySrc.rows) {
      console.log(`  ${r.source}: ${r.cnt} (${r.test_cnt} test)`);
    }

    // By date
    const byDate = await pool.query(`
      SELECT DATE(created_at) as day, COUNT(*) as cnt
      FROM email_subscribers 
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day DESC
      LIMIT 10
    `);
    console.log('\nLast 10 days:');
    for (const r of byDate.rows) {
      console.log(`  ${r.day?.toISOString?.().slice(0,10) || r.day}: ${r.cnt}`);
    }

    // Recent subscribers (last 5)
    const recent = await pool.query(`
      SELECT email, source, vehicle_year, vehicle_make, vehicle_model, created_at, is_test
      FROM email_subscribers 
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('\nRecent subscribers:');
    for (const r of recent.rows) {
      const vehicle = r.vehicle_year ? `${r.vehicle_year} ${r.vehicle_make} ${r.vehicle_model}` : 'no vehicle';
      console.log(`  ${r.email} | ${r.source} | ${vehicle} | ${r.created_at?.toISOString?.().slice(0,16)} | test=${r.is_test}`);
    }
  } catch (err) {
    console.log(`❌ Error querying email_subscribers: ${err.message}`);
  }

  // 3. Check exit_intent specifically
  console.log('\n--- 3. EXIT INTENT CAPTURES ---');
  try {
    const exitIntent = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM email_subscribers 
      WHERE source = 'exit_intent'
    `);
    console.log(`Exit intent captures: ${exitIntent.rows[0].cnt}`);

    const exitIntentReal = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM email_subscribers 
      WHERE source = 'exit_intent' AND (is_test = false OR is_test IS NULL)
    `);
    console.log(`Exit intent (non-test): ${exitIntentReal.rows[0].cnt}`);
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }

  // 4. Check abandoned_carts for email linkage
  console.log('\n--- 4. ABANDONED CART EMAIL LINKAGE ---');
  try {
    const cartsWithEmail = await pool.query(`
      SELECT COUNT(*) as cnt FROM abandoned_carts WHERE customer_email IS NOT NULL
    `);
    const cartsTotal = await pool.query(`SELECT COUNT(*) as cnt FROM abandoned_carts`);
    console.log(`Carts with email: ${cartsWithEmail.rows[0].cnt} / ${cartsTotal.rows[0].cnt}`);

    // Recent carts with emails
    const recentCarts = await pool.query(`
      SELECT cart_id, customer_email, status, estimated_total, created_at
      FROM abandoned_carts 
      WHERE customer_email IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('\nRecent carts with emails:');
    for (const c of recentCarts.rows) {
      console.log(`  ${c.cart_id?.slice(0,8)}... | ${c.customer_email} | ${c.status} | $${c.estimated_total}`);
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }

  // 5. Check admin_logs for any exit intent errors
  console.log('\n--- 5. ERROR LOGS (exit/subscribe related) ---');
  try {
    const logs = await pool.query(`
      SELECT log_type, details, created_at
      FROM admin_logs 
      WHERE (details::text ILIKE '%exit%' OR details::text ILIKE '%subscribe%' OR details::text ILIKE '%email%capture%')
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    if (logs.rows.length === 0) {
      console.log('No related error logs found');
    } else {
      for (const l of logs.rows) {
        console.log(`  ${l.log_type}: ${JSON.stringify(l.details).slice(0,100)}...`);
      }
    }
  } catch (err) {
    console.log(`(admin_logs table may not exist or different schema)`);
  }

  // 6. Summary
  console.log('\n=== SUMMARY ===');
  console.log('The exit intent popup flow is:');
  console.log('1. ExitIntentPopup.tsx renders when triggered by useExitIntent hook');
  console.log('2. On submit, calls POST /api/email/subscribe with source="exit_intent"');
  console.log('3. subscriberService.subscribe() inserts into email_subscribers');
  console.log('4. Also calls /api/cart/track to link email to abandoned cart');
  console.log('\nPotential failure points:');
  console.log('- Modal not showing (trigger rules too strict or delayMs too long)');
  console.log('- Modal showing but users not submitting (UX/copy issue)');
  console.log('- Submit failing silently (API error)');
  console.log('- Data stored but marked as test (auto-detection)');

  await pool.end();
}

main().catch(console.error);
