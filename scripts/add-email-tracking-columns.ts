/**
 * Add third email tracking columns to abandoned_carts
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
  console.log("Adding email tracking columns to abandoned_carts...");

  // Add third_email_sent_at column
  await db.execute(sql`
    ALTER TABLE abandoned_carts 
    ADD COLUMN IF NOT EXISTS third_email_sent_at TIMESTAMP
  `);
  console.log("  ✓ third_email_sent_at");

  // Add last_email_status column
  await db.execute(sql`
    ALTER TABLE abandoned_carts 
    ADD COLUMN IF NOT EXISTS last_email_status VARCHAR(50)
  `);
  console.log("  ✓ last_email_status");

  console.log("\n✅ Email tracking columns added successfully!");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
