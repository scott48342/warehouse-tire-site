/**
 * Check orders table and Stripe integration
 */
import pg from 'pg';
const { Pool } = pg;

const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connString,
  ssl: connString?.includes('prisma.io') ? { rejectUnauthorized: false } : false
});

async function check() {
  console.log('=== ORDERS TABLE SCHEMA ===');
  try {
    const schema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);
    console.log('Columns:', schema.rows.map(r => r.column_name).join(', '));
    
    const count = await pool.query('SELECT COUNT(*) FROM orders');
    console.log('Total orders:', count.rows[0].count);
    
    if (parseInt(count.rows[0].count) > 0) {
      const recent = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
      console.log('\nRecent orders:');
      recent.rows.forEach(o => {
        console.log(JSON.stringify(o, null, 2));
      });
    } else {
      console.log('\n⚠️  NO ORDERS IN DATABASE');
    }
  } catch (e) {
    console.log('Orders table error:', e.message);
  }
  
  console.log('\n=== ALL TABLES ===');
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));

  console.log('\n=== LOOKING FOR PAYMENT/ORDER RELATED TABLES ===');
  const relevantTables = tables.rows.filter(t => 
    t.table_name.includes('order') || 
    t.table_name.includes('payment') || 
    t.table_name.includes('stripe') ||
    t.table_name.includes('checkout') ||
    t.table_name.includes('purchase')
  );
  console.log('Found:', relevantTables.map(r => r.table_name).join(', ') || 'none');

  // Check supplier_orders table
  console.log('\n=== SUPPLIER ORDERS (from auto-order system) ===');
  try {
    const supplierOrders = await pool.query(`
      SELECT * FROM supplier_orders 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    if (supplierOrders.rows.length > 0) {
      console.log('Recent supplier orders:');
      supplierOrders.rows.forEach(o => console.log(o));
    } else {
      console.log('No supplier orders found');
    }
  } catch (e) {
    console.log('No supplier_orders table or error:', e.message);
  }

  await pool.end();
}

check().catch(console.error);
