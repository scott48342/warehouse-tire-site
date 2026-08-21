require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connString = process.env.POSTGRES_URL;
const pool = new Pool({ 
  connectionString: connString,
  ssl: connString && connString.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined
});

async function main() {
  const migrationPath = path.join(__dirname, '../drizzle/migrations/0001_add_auth_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Applying auth tables migration...');
  console.log('SQL to execute:');
  console.log('─'.repeat(60));
  console.log(sql);
  console.log('─'.repeat(60));
  
  try {
    await pool.query(sql);
    console.log('\n✅ Migration applied successfully!');
    
    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'auth_%'
      ORDER BY table_name
    `);
    
    console.log('\nAuth tables created:');
    result.rows.forEach(row => console.log('  ✓ ' + row.table_name));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
