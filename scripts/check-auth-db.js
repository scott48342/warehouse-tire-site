const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  // Check auth_users
  const users = await pool.query("SELECT id, email, email_verified, created_at FROM auth_users");
  console.log('Users:', users.rows);
  
  // Check auth_verifications  
  const verifications = await pool.query("SELECT id, identifier, expires_at FROM auth_verifications ORDER BY created_at DESC LIMIT 3");
  console.log('Verifications:', verifications.rows);
  
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
