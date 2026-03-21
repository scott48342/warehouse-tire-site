import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  console.log('Testing database connection...');
  console.log('URL:', process.env.POSTGRES_URL?.substring(0, 50) + '...');
  
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW() as time');
    console.log('✅ Connected! Server time:', res.rows[0].time);
    
    // Check vehicle_fitments table
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'vehicle%' OR table_name LIKE 'fitment%'
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name));
    
    // Check column types
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_fitments' 
      AND column_name IN ('offset_min_mm', 'offset_max_mm')
    `);
    console.log('Offset columns:', cols.rows);
  } finally {
    client.release();
    pool.end();
  }
}

test().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
