const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const tables = ['auth_users', 'auth_sessions', 'auth_accounts', 'auth_verifications'];
  
  for (const table of tables) {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    
    console.log(`\n${table}:`);
    result.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : ''}`));
  }
  
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
