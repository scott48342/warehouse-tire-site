import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const result = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments' 
  ORDER BY ordinal_position
`);

console.log('vehicle_fitments columns:');
for (const row of result.rows) {
  console.log(`  ${row.column_name}: ${row.data_type}`);
}

await pool.end();
