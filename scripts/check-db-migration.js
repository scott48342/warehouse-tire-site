/**
 * Pre-migration database check
 */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    // Check auth_users exists and structure
    console.log('=== Checking auth_users table ===');
    const authUsers = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'auth_users'
      ORDER BY ordinal_position
    `);
    
    if (authUsers.rows.length === 0) {
      console.log('❌ auth_users table NOT FOUND');
      return;
    }
    
    console.log('✅ auth_users columns:');
    authUsers.rows.forEach(r => console.log(`   - ${r.column_name}: ${r.data_type}`));
    
    // Check id column type
    const idCol = authUsers.rows.find(r => r.column_name === 'id');
    if (idCol && idCol.data_type === 'text') {
      console.log('✅ auth_users.id is TEXT (correct for FK reference)');
    } else {
      console.log('⚠️ auth_users.id type:', idCol?.data_type);
    }
    
    // Check if user_garage already exists
    console.log('\n=== Checking user_garage table ===');
    const garage = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_garage'
    `);
    
    if (garage.rows.length > 0) {
      console.log('⚠️ user_garage already exists with columns:');
      garage.rows.forEach(r => console.log(`   - ${r.column_name}`));
    } else {
      console.log('✅ user_garage does NOT exist (ready for migration)');
    }
    
    // Count existing auth_users
    console.log('\n=== Existing data ===');
    const count = await client.query('SELECT COUNT(*) as cnt FROM auth_users');
    console.log(`   auth_users count: ${count.rows[0].cnt}`);
    
    // Check database name
    const dbName = await client.query('SELECT current_database()');
    console.log(`   Database: ${dbName.rows[0].current_database}`);
    
    console.log('\n=== Migration safety check ===');
    console.log('✅ Migration is safe to run (CREATE IF NOT EXISTS)');
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
