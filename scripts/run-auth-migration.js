const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const sql = fs.readFileSync('drizzle/migrations/0040_auth_tables.sql', 'utf8');
  console.log('Running auth tables migration...');
  await pool.query(sql);
  console.log('Migration complete!');
  
  // Verify tables exist
  const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'auth_%'");
  console.log('Auth tables:', result.rows.map(r => r.table_name));
  
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
