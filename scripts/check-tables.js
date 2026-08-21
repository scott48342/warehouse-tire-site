const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const connString = process.env.POSTGRES_URL;
const pool = new Pool({ 
  connectionString: connString,
  ssl: connString && connString.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined
});

async function main() {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('Existing tables in production database:');
  result.rows.forEach(row => console.log('  ' + row.table_name));
  
  // Check if any auth_ tables already exist
  const authTables = result.rows.filter(r => r.table_name.startsWith('auth_'));
  if (authTables.length > 0) {
    console.log('\nWARNING: Auth tables already exist:');
    authTables.forEach(row => console.log('  ' + row.table_name));
  } else {
    console.log('\nNo auth_ tables found - safe to create.');
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
