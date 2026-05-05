import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function run() {
  const sqlPath = path.join(__dirname, '../drizzle/migrations/0030_wheel_size_trim_mappings.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  console.log('Connecting to database...');
  const client = await pool.connect();
  
  try {
    console.log('Running migration 0030_wheel_size_trim_mappings.sql...');
    await client.query(sql);
    console.log('✅ Migration complete!');
    
    // Verify table exists
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'wheel_size_trim_mappings'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Table wheel_size_trim_mappings exists');
    } else {
      console.log('❌ Table not found!');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
