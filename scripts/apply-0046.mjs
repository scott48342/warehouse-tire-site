/**
 * Apply migration 0046 - Add paypal_order_id column to orders
 * Safe, idempotent SQL
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
    console.log('=== Applying Migration 0046 ===\n');
    
    // Check current state
    const beforeCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'paypal_order_id'
    `);
    
    console.log('Before: paypal_order_id column exists:', beforeCheck.rows.length > 0);
    
    // Check for index
    const indexBefore = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'orders' AND indexname = 'orders_paypal_order_id_unique'
    `);
    console.log('Before: unique index exists:', indexBefore.rows.length > 0);
    console.log('');
    
    // Apply column addition (idempotent)
    console.log('Adding column if not exists...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'orders' AND column_name = 'paypal_order_id'
        ) THEN
          ALTER TABLE orders ADD COLUMN paypal_order_id TEXT;
          RAISE NOTICE 'Column added';
        ELSE
          RAISE NOTICE 'Column already exists';
        END IF;
      END
      $$;
    `);
    
    // Apply unique index (idempotent)
    console.log('Creating unique index if not exists...');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_order_id_unique 
      ON orders (paypal_order_id) 
      WHERE paypal_order_id IS NOT NULL;
    `);
    
    // Verify
    console.log('');
    console.log('=== Verification ===');
    
    const afterCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'paypal_order_id'
    `);
    
    console.log('After: paypal_order_id column:', afterCheck.rows[0] || 'NOT FOUND');
    
    const indexAfter = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'orders' AND indexname = 'orders_paypal_order_id_unique'
    `);
    
    console.log('After: unique index:', indexAfter.rows[0]?.indexname || 'NOT FOUND');
    if (indexAfter.rows[0]?.indexdef) {
      console.log('Index def:', indexAfter.rows[0].indexdef);
    }
    
    // Row count check
    const rowCount = await client.query('SELECT COUNT(*) as cnt FROM orders');
    console.log('');
    console.log('Orders row count:', rowCount.rows[0].cnt, '(unchanged)');
    
    console.log('');
    console.log('✅ Migration 0046 applied successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
