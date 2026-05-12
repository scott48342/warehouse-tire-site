import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  // Check orders in last 7 days
  const ordersResult = await pool.query(`
    SELECT id, created_at, status, amount_paid_cents, customer_email 
    FROM orders 
    WHERE created_at > NOW() - INTERVAL '7 days' 
    ORDER BY created_at DESC
    LIMIT 20
  `);
  
  console.log(`\n=== Orders (last 7 days): ${ordersResult.rows.length} ===\n`);
  if (ordersResult.rows.length === 0) {
    console.log('No orders in the last 7 days.');
  } else {
    ordersResult.rows.forEach(o => {
      const date = new Date(o.created_at).toLocaleDateString();
      const amount = (o.amount_paid_cents / 100).toFixed(2);
      console.log(`${date} | $${amount} | ${o.status} | ${o.customer_email || 'no email'}`);
    });
  }

  // Check recent 30 days for context
  const monthResult = await pool.query(`
    SELECT COUNT(*) as count, SUM(amount_paid_cents) as total 
    FROM orders 
    WHERE created_at > NOW() - INTERVAL '30 days'
  `);
  
  const monthCount = monthResult.rows[0].count;
  const monthTotal = monthResult.rows[0].total ? (monthResult.rows[0].total / 100).toFixed(2) : '0.00';
  console.log(`\n=== Last 30 days: ${monthCount} orders, $${monthTotal} total ===\n`);

  // Check all time for context
  const allTimeResult = await pool.query(`
    SELECT COUNT(*) as count, SUM(amount_paid_cents) as total,
           MIN(created_at) as first_order
    FROM orders
  `);
  
  const allCount = allTimeResult.rows[0].count;
  const allTotal = allTimeResult.rows[0].total ? (allTimeResult.rows[0].total / 100).toFixed(2) : '0.00';
  const firstOrder = allTimeResult.rows[0].first_order ? new Date(allTimeResult.rows[0].first_order).toLocaleDateString() : 'N/A';
  console.log(`=== All time: ${allCount} orders, $${allTotal} total (since ${firstOrder}) ===\n`);

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
}
