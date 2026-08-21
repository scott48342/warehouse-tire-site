const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  // List all tables  
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('All tables:');
  tables.rows.forEach(r => console.log('  -', r.table_name));
  
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
