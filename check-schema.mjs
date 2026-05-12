import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  // Check orders table columns
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'orders'
    ORDER BY ordinal_position
  `);
  
  console.log('\n=== Orders table columns ===\n');
  result.rows.forEach(r => {
    console.log(`${r.column_name}: ${r.data_type}`);
  });

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
}
