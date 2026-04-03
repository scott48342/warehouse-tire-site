/**
 * Add test data columns to abandoned_carts and email_subscribers
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
  console.log("Adding test data columns...\n");

  // abandoned_carts
  console.log("1. abandoned_carts:");
  
  await db.execute(sql`
    ALTER TABLE abandoned_carts 
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("   ✓ is_test");

  await db.execute(sql`
    ALTER TABLE abandoned_carts 
    ADD COLUMN IF NOT EXISTS test_reason VARCHAR(100)
  `);
  console.log("   ✓ test_reason");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS abandoned_carts_is_test_idx 
    ON abandoned_carts (is_test)
  `);
  console.log("   ✓ is_test index");

  // email_subscribers
  console.log("\n2. email_subscribers:");

  await db.execute(sql`
    ALTER TABLE email_subscribers 
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("   ✓ is_test");

  await db.execute(sql`
    ALTER TABLE email_subscribers 
    ADD COLUMN IF NOT EXISTS test_reason VARCHAR(100)
  `);
  console.log("   ✓ test_reason");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_subscribers_is_test_idx 
    ON email_subscribers (is_test)
  `);
  console.log("   ✓ is_test index");

  // Mark existing internal emails as test
  console.log("\n3. Marking existing internal emails as test...");

  const internalPatterns = [
    '%@warehousetiredirect.com',
    '%@wtd.com',
    'test%',
    'dev%',
    '%@example.com',
    '%@test.com',
    'scott@%',
  ];

  for (const pattern of internalPatterns) {
    const result = await db.execute(sql`
      UPDATE abandoned_carts 
      SET is_test = true, test_reason = 'internal_email'
      WHERE customer_email ILIKE ${pattern}
      AND is_test = false
    `);
    console.log(`   Updated carts matching: ${pattern}`);
  }

  for (const pattern of internalPatterns) {
    await db.execute(sql`
      UPDATE email_subscribers 
      SET is_test = true, test_reason = 'internal_email'
      WHERE email ILIKE ${pattern}
      AND is_test = false
    `);
    console.log(`   Updated subscribers matching: ${pattern}`);
  }

  console.log("\n✅ Test data columns added successfully!");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
