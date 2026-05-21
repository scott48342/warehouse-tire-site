import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Get orders table columns
const { rows } = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'orders'
  ORDER BY ordinal_position
`);

console.log('Orders table columns:');
for (const row of rows) {
  console.log(`  ${row.column_name}: ${row.data_type}`);
}

// Get recent orders
const { rows: orders } = await pool.query(`
  SELECT * FROM orders ORDER BY created_at DESC LIMIT 3
`);

console.log('\nRecent orders:');
for (const order of orders) {
  console.log(JSON.stringify(order, null, 2));
}

await pool.end();
