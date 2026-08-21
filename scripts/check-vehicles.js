const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const user = await pool.query("SELECT id FROM auth_users WHERE email = 'scott@warehousetire.net'");
  const userId = user.rows[0].id;
  console.log('User ID:', userId);
  
  const vehicles = await pool.query('SELECT id, year, make, model, modification FROM user_garage WHERE user_id = $1 ORDER BY added_at', [userId]);
  console.log('Vehicles in DB:', vehicles.rows);
  pool.end();
}
check();
