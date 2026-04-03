/**
 * Create email_subscribers table
 * Run: npx tsx scripts/create-email-subscribers-table.ts
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const db = drizzle(pool);

async function main() {
  console.log("Creating email_subscribers table...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_subscribers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      source VARCHAR(50) NOT NULL,
      vehicle_year VARCHAR(10),
      vehicle_make VARCHAR(100),
      vehicle_model VARCHAR(100),
      vehicle_trim VARCHAR(255),
      cart_id VARCHAR(64),
      marketing_consent BOOLEAN NOT NULL DEFAULT true,
      unsubscribed BOOLEAN NOT NULL DEFAULT false,
      unsubscribed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address VARCHAR(45),
      user_agent TEXT
    )
  `);

  console.log("Creating indexes...");

  // Unique constraint on email + source
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_subscribers_email_source_idx 
    ON email_subscribers (email, source)
  `);

  // Email lookup
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_subscribers_email_idx 
    ON email_subscribers (email)
  `);

  // Source filtering
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_subscribers_source_idx 
    ON email_subscribers (source)
  `);

  // Vehicle queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_subscribers_vehicle_idx 
    ON email_subscribers (vehicle_year, vehicle_make, vehicle_model)
  `);

  // Cart linking
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_subscribers_cart_id_idx 
    ON email_subscribers (cart_id)
  `);

  console.log("✅ email_subscribers table created successfully!");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
