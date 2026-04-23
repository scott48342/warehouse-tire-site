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
  // Check orders table schema
  console.log('=== Orders table columns ===');
  const schema = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'orders'
    ORDER BY ordinal_position
  `);
  for (const col of schema.rows) {
    console.log(`${col.column_name}: ${col.data_type}`);
  }

  // Count orders
  console.log('\n=== Orders count ===');
  const orderCount = await pool.query(`SELECT COUNT(*) as cnt FROM orders`);
  console.log(`Total orders: ${orderCount.rows[0].cnt}`);

  // Show recent orders
  console.log('\n=== Recent Orders ===');
  const recent = await pool.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 5`);
  for (const o of recent.rows) {
    console.log(JSON.stringify(o, null, 2));
  }

  // Count quotes excluding scott@warehousetire.net
  console.log('\n=== Quotes (excluding scott@warehousetire.net) ===');
  const quotesAll = await pool.query(`SELECT COUNT(*) as cnt FROM quotes`);
  const quotesExcludeScott = await pool.query(`
    SELECT COUNT(*) as cnt FROM quotes 
    WHERE customer_email NOT ILIKE '%warehousetire%'
      AND customer_email NOT ILIKE '%scott%'
  `);
  console.log(`All quotes: ${quotesAll.rows[0].cnt}`);
  console.log(`Excluding test emails: ${quotesExcludeScott.rows[0].cnt}`);

  await pool.end();
}

main().catch(console.error);
