const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const users = await pool.query("SELECT id, email, email_verified FROM auth_users WHERE email LIKE '%wtdtest%'");
  console.log('User:', users.rows[0]);
  
  if (users.rows[0]) {
    const accounts = await pool.query('SELECT id, provider_id, issuer, password IS NOT NULL as has_password FROM auth_accounts WHERE user_id = $1', [users.rows[0].id]);
    console.log('Account:', accounts.rows[0]);
  }
  
  const verifications = await pool.query('SELECT id, identifier, expires_at FROM auth_verifications ORDER BY created_at DESC LIMIT 1');
  console.log('Latest verification:', verifications.rows[0] || 'none');
  
  await pool.end();
}
run();
