const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const accounts = await pool.query(`
    SELECT id, user_id, provider_id, account_id, issuer, password IS NOT NULL as has_password, created_at
    FROM auth_accounts
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log('Recent Accounts:');
  accounts.rows.forEach(r => console.log(r));
  
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
