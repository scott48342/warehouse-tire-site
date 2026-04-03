import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const sql = fs.readFileSync('drizzle/migrations/0020_email_campaigns.sql', 'utf8');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log('Running migration 0020_email_campaigns.sql...');
  await pool.query(sql);
  console.log('✅ Migration complete!');
  
  // Verify tables exist
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'email_campaign%'
    ORDER BY table_name
  `);
  
  console.log('\nCreated tables:');
  for (const row of result.rows) {
    console.log(`  - ${row.table_name}`);
  }
  
  // Check email_subscribers new columns
  const cols = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'email_subscribers'
    AND column_name IN ('unsubscribe_token', 'suppression_reason', 'last_active_at', 'last_campaign_sent_at')
  `);
  
  console.log('\nNew email_subscribers columns:');
  for (const row of cols.rows) {
    console.log(`  - ${row.column_name}`);
  }
  
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
