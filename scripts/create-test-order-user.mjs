/**
 * Create a test user with a verified email that matches an existing order.
 * This allows testing the My Orders flow end-to-end.
 * 
 * Run: node scripts/create-test-order-user.mjs
 */

import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = pg;

async function main() {
  const connStr = process.env.POSTGRES_URL;
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  
  try {
    // Find an order that we can create a matching user for
    console.log("\n=== Finding an order to match ===");
    const orderResult = await pool.query(
      `SELECT id, customer_email, status, amount_paid_cents 
       FROM orders 
       WHERE customer_email IS NOT NULL 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    if (orderResult.rows.length === 0) {
      console.log("No orders found in database!");
      return;
    }
    
    const order = orderResult.rows[0];
    console.log(`Found order: ${order.id} for ${order.customer_email}`);
    
    // Check if a user already exists for this email
    const existingUser = await pool.query(
      `SELECT id, email, email_verified FROM auth_users WHERE LOWER(email) = LOWER($1)`,
      [order.customer_email]
    );
    
    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      console.log(`\nUser already exists: ${user.id}`);
      console.log(`Email verified: ${user.email_verified}`);
      
      if (!user.email_verified) {
        // Update to verified for testing
        await pool.query(
          `UPDATE auth_users SET email_verified = true, updated_at = NOW() WHERE id = $1`,
          [user.id]
        );
        console.log("✅ Set email_verified = true for testing");
      }
      return;
    }
    
    // Create a new user with verified email
    const userId = crypto.randomUUID();
    const now = new Date();
    
    await pool.query(`
      INSERT INTO auth_users (id, email, email_verified, name, created_at, updated_at)
      VALUES ($1, $2, true, $3, $4, $4)
    `, [
      userId,
      order.customer_email,
      'Test User',
      now,
    ]);
    
    console.log(`\n✅ Created test user:`);
    console.log(`   ID: ${userId}`);
    console.log(`   Email: ${order.customer_email}`);
    console.log(`   Email Verified: true`);
    console.log(`\n   This user will see order ${order.id} in their account.`);
    console.log(`\n   Note: This user has NO password set - use magic link or`);
    console.log(`   add a password/account manually for testing.`);
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
