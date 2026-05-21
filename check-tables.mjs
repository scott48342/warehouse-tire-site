import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const { rows } = await pool.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name
`);

console.log('Tables:', rows.map(r => r.table_name));

// Check if supplier_orders exists
const soCheck = await pool.query(`
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'supplier_orders'
  )
`);
console.log('supplier_orders exists:', soCheck.rows[0].exists);

await pool.end();
