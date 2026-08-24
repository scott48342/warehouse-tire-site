// Quick script to check orders and users in database
// Uses the same pg pool pattern as the app

import pg from 'pg';
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
    // Check auth users
    console.log("\n=== Auth Users (latest 3) ===");
    const usersResult = await pool.query(
      `SELECT id, email, email_verified, created_at FROM auth_users ORDER BY created_at DESC LIMIT 3`
    );
    console.table(usersResult.rows);
    
    // Check orders
    console.log("\n=== Orders (latest 5) ===");
    const ordersResult = await pool.query(
      `SELECT id, customer_email, status, amount_paid_cents, created_at FROM orders ORDER BY created_at DESC LIMIT 5`
    );
    console.table(ordersResult.rows);
    
    // Check if there are any orders matching existing users
    console.log("\n=== Matching Orders to Users ===");
    const matchResult = await pool.query(`
      SELECT u.email AS user_email, u.email_verified, o.id AS order_id, o.status, o.created_at
      FROM auth_users u
      JOIN orders o ON LOWER(TRIM(u.email)) = LOWER(TRIM(o.customer_email))
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    console.table(matchResult.rows);
    
    if (matchResult.rows.length === 0) {
      console.log("No matching orders found for any auth users.");
    }
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
