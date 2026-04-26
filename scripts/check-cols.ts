import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments'
    ORDER BY ordinal_position
  `);
  console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
  await pool.end();
}
main();
