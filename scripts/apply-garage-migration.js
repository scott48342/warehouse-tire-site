/**
 * Apply user_garage migration
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Read migration SQL
    const sqlPath = path.join(__dirname, '../drizzle/migrations/0041_user_garage.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('=== Applying Migration ===');
    console.log(sql);
    console.log('\n=== Executing... ===');
    
    await client.query(sql);
    
    console.log('✅ Migration applied successfully');
    
    // Verify table created
    console.log('\n=== Verifying table ===');
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'user_garage'
      ORDER BY ordinal_position
    `);
    
    console.log('user_garage columns:');
    cols.rows.forEach(r => {
      console.log(`   - ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });
    
    // Verify indexes
    console.log('\n=== Verifying indexes ===');
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'user_garage'
    `);
    
    indexes.rows.forEach(r => {
      console.log(`   - ${r.indexname}`);
    });
    
    // Verify FK constraint
    console.log('\n=== Verifying foreign key ===');
    const fks = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'user_garage' AND tc.constraint_type = 'FOREIGN KEY'
    `);
    
    if (fks.rows.length > 0) {
      fks.rows.forEach(r => {
        console.log(`   - ${r.constraint_name}: ${r.column_name} -> ${r.foreign_table}(${r.foreign_column})`);
      });
    } else {
      console.log('   (no explicit FK constraints found - inline reference may be used)');
    }
    
    console.log('\n✅ Migration complete');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  process.exit(1);
});
