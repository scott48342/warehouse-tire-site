import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments'
    ORDER BY ordinal_position
  `);
  console.log('vehicle_fitments columns:');
  res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  await pool.end();
}
main();
