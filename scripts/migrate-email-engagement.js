/**
 * Migration: Add email engagement tracking columns
 * Run with: node scripts/migrate-email-engagement.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: email engagement tracking...');
    
    // Check if columns already exist
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'abandoned_carts' 
      AND column_name IN ('email_opened_at', 'email_clicked_at', 'email_open_count', 'email_click_count')
    `);
    
    const existingColumns = checkResult.rows.map(r => r.column_name);
    console.log('Existing columns:', existingColumns.length ? existingColumns.join(', ') : 'none');
    
    // Add columns if they don't exist
    if (!existingColumns.includes('email_opened_at')) {
      console.log('Adding email_opened_at...');
      await client.query('ALTER TABLE abandoned_carts ADD COLUMN email_opened_at TIMESTAMP');
    }
    
    if (!existingColumns.includes('email_clicked_at')) {
      console.log('Adding email_clicked_at...');
      await client.query('ALTER TABLE abandoned_carts ADD COLUMN email_clicked_at TIMESTAMP');
    }
    
    if (!existingColumns.includes('email_open_count')) {
      console.log('Adding email_open_count...');
      await client.query('ALTER TABLE abandoned_carts ADD COLUMN email_open_count INTEGER NOT NULL DEFAULT 0');
    }
    
    if (!existingColumns.includes('email_click_count')) {
      console.log('Adding email_click_count...');
      await client.query('ALTER TABLE abandoned_carts ADD COLUMN email_click_count INTEGER NOT NULL DEFAULT 0');
    }
    
    // Check if index exists
    const indexResult = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'abandoned_carts' 
      AND indexname = 'abandoned_carts_email_engagement_idx'
    `);
    
    if (indexResult.rows.length === 0) {
      console.log('Creating index abandoned_carts_email_engagement_idx...');
      await client.query(`
        CREATE INDEX abandoned_carts_email_engagement_idx 
        ON abandoned_carts(email_opened_at, email_clicked_at)
      `);
    } else {
      console.log('Index already exists');
    }
    
    console.log('✅ Migration complete!');
    
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
