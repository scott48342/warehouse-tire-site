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
    // Check exact column types
    const result = await client.query(`
      SELECT table_name, column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name IN ('saved_quotes', 'pending_saved_quotes', 'user_garage')
      AND column_name LIKE '%json%' OR column_name = 'snapshot_json'
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('=== JSON/JSONB Columns ===');
    result.rows.forEach(r => {
      console.log(`${r.table_name}.${r.column_name}: ${r.data_type} (udt: ${r.udt_name})`);
    });
    
    // Test a simple query on saved_quotes
    console.log('');
    console.log('=== Testing saved_quotes SELECT ===');
    const testQuery = await client.query(`
      SELECT id, user_id, name, 
             pg_typeof(snapshot_json) as snapshot_type,
             LEFT(snapshot_json::text, 100) as snapshot_preview
      FROM saved_quotes
      LIMIT 3
    `);
    testQuery.rows.forEach(r => {
      console.log(`ID: ${r.id}`);
      console.log(`  user_id: ${r.user_id}`);
      console.log(`  snapshot type: ${r.snapshot_type}`);
      console.log(`  preview: ${r.snapshot_preview}...`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
