import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const { rows } = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'supplier_orders'
  ORDER BY ordinal_position
`);

console.log('supplier_orders columns:');
for (const row of rows) {
  console.log(`  ${row.column_name}: ${row.data_type}`);
}

await pool.end();
