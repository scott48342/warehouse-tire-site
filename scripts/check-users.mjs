import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // Find all users with garage vehicles
    const result = await client.query(`
      SELECT 
        u.id, 
        u.email, 
        u.name,
        COUNT(g.id) as vehicle_count
      FROM auth_users u
      LEFT JOIN user_garage g ON g.user_id = u.id
      GROUP BY u.id, u.email, u.name
      HAVING COUNT(g.id) > 0
      ORDER BY vehicle_count DESC
    `);
    
    console.log('Users with garage vehicles:');
    result.rows.forEach(r => {
      console.log(`- ${r.email}: ${r.vehicle_count} vehicles (id: ${r.id.substring(0,8)}...)`);
    });
    
    // Check test user specifically
    console.log('');
    const testUser = await client.query(`
      SELECT id, email, email_verified, created_at 
      FROM auth_users 
      WHERE email = 'test-isolation@warehousetire.net'
    `);
    console.log('Test user details:');
    console.log(testUser.rows[0]);
    
    // Check sessions
    console.log('');
    const sessions = await client.query(`
      SELECT s.id, s.user_id, s.expires_at, u.email
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      ORDER BY s.expires_at DESC
    `);
    console.log('Active sessions:');
    sessions.rows.forEach(s => {
      console.log(`- ${s.email} (expires: ${s.expires_at})`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
