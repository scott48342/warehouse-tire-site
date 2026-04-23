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
  // Check schema
  const schema = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'quotes'
    ORDER BY ordinal_position
  `);
  console.log('=== Quote Table Schema ===');
  for (const col of schema.rows) {
    console.log(`${col.column_name}: ${col.data_type}`);
  }

  // Get recent quotes with correct columns
  console.log('\n=== Recent Quotes ===');
  const recent = await pool.query(`SELECT * FROM quotes ORDER BY created_at DESC LIMIT 10`);
  for (const q of recent.rows) {
    console.log(JSON.stringify(q, null, 2));
  }

  await pool.end();
}

main().catch(console.error);
