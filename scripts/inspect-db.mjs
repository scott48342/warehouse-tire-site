/**
 * Database Schema Inspector
 * Run with: node scripts/inspect-db.mjs
 */

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
    // Get database info
    const dbInfo = await client.query(`SELECT current_database(), current_user, inet_server_addr(), version()`);
    console.log('=== DATABASE INFO ===');
    console.log('Database:', dbInfo.rows[0].current_database);
    console.log('User:', dbInfo.rows[0].current_user);
    console.log('Server:', dbInfo.rows[0].inet_server_addr);
    console.log('');
    
    // List all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('=== ALL TABLES ===');
    tables.rows.forEach(r => console.log('-', r.table_name));
    console.log('Total tables:', tables.rows.length);
    console.log('');

    // Check specific tables
    const targetTables = [
      'auth_users',
      'auth_sessions', 
      'auth_accounts',
      'auth_verifications',
      'user_garage',
      'orders',
      'quotes',
      'saved_quotes',
      'pending_saved_quotes'
    ];

    console.log('=== TARGET TABLE CHECK ===');
    for (const tableName of targetTables) {
      const exists = tables.rows.some(r => r.table_name === tableName);
      const count = exists 
        ? (await client.query(`SELECT COUNT(*) as c FROM "${tableName}"`)).rows[0].c
        : 'N/A';
      console.log(`${exists ? '✅' : '❌'} ${tableName}: ${exists ? `EXISTS (${count} rows)` : 'MISSING'}`);
    }
    console.log('');

    // Check user_garage schema if exists
    if (tables.rows.some(r => r.table_name === 'user_garage')) {
      console.log('=== user_garage COLUMNS ===');
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'user_garage'
        ORDER BY ordinal_position
      `);
      cols.rows.forEach(c => console.log(`- ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`));
      console.log('');

      // Check indexes
      console.log('=== user_garage INDEXES ===');
      const idx = await client.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'user_garage'
      `);
      idx.rows.forEach(i => console.log(`- ${i.indexname}`));
      console.log('');
    }

    // Check saved_quotes schema if exists
    if (tables.rows.some(r => r.table_name === 'saved_quotes')) {
      console.log('=== saved_quotes COLUMNS ===');
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'saved_quotes'
        ORDER BY ordinal_position
      `);
      cols.rows.forEach(c => console.log(`- ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`));
      console.log('');

      // Check indexes
      console.log('=== saved_quotes INDEXES ===');
      const idx = await client.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'saved_quotes'
      `);
      idx.rows.forEach(i => console.log(`- ${i.indexname}`));
      console.log('');
    }

    // Check pending_saved_quotes schema if exists
    if (tables.rows.some(r => r.table_name === 'pending_saved_quotes')) {
      console.log('=== pending_saved_quotes COLUMNS ===');
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'pending_saved_quotes'
        ORDER BY ordinal_position
      `);
      cols.rows.forEach(c => console.log(`- ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`));
      console.log('');
    }

    // Check orders table for paypal_order_id column
    if (tables.rows.some(r => r.table_name === 'orders')) {
      console.log('=== orders COLUMNS (checking for paypal_order_id) ===');
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'orders'
        ORDER BY ordinal_position
      `);
      const hasPaypalOrderId = cols.rows.some(c => c.column_name === 'paypal_order_id');
      console.log(`paypal_order_id column: ${hasPaypalOrderId ? '✅ EXISTS' : '❌ MISSING'}`);
      
      // Check for customer_email index
      console.log('');
      console.log('=== orders INDEXES ===');
      const idx = await client.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'orders'
      `);
      idx.rows.forEach(i => console.log(`- ${i.indexname}`));
      console.log('');
    }

    // Check drizzle migration journal
    console.log('=== DRIZZLE MIGRATION JOURNAL ===');
    const hasDrizzle = tables.rows.some(r => r.table_name === '__drizzle_migrations');
    if (hasDrizzle) {
      const migrations = await client.query(`SELECT * FROM __drizzle_migrations ORDER BY created_at`);
      console.log(`Found ${migrations.rows.length} migration records:`);
      migrations.rows.forEach(m => {
        console.log(`- ${m.hash?.substring(0, 12)}... at ${m.created_at}`);
      });
    } else {
      console.log('❌ __drizzle_migrations table NOT FOUND');
      console.log('   Migrations may have been applied manually without Drizzle tracking');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
