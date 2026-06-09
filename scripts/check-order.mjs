import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL
});

async function main() {
  const orderRes = await pool.query(`SELECT * FROM orders WHERE id LIKE '%T5JT8F%'`);
  console.log('Order:', JSON.stringify(orderRes.rows[0], null, 2));
  
  if (orderRes.rows[0]) {
    const supplierRes = await pool.query(`SELECT * FROM supplier_orders WHERE order_id = $1`, [orderRes.rows[0].id]);
    console.log('Supplier Orders:', JSON.stringify(supplierRes.rows, null, 2));
  }
  
  await pool.end();
}

main().catch(console.error);
