const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const accounts = await pool.query("SELECT id, user_id, provider_id, account_id, password IS NOT NULL as has_password FROM auth_accounts");
  console.log('Accounts:', accounts.rows);
  
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
