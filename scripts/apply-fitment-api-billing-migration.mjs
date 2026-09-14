/**
 * Apply drizzle/migrations/0047_api_keys_stripe_billing.sql
 *
 * Adds Stripe billing columns to api_keys for self-serve Fitment API signup.
 * The SQL is idempotent (IF NOT EXISTS everywhere), so re-running is safe.
 *
 * Usage (from repo root, POSTGRES_URL in env or .env.local):
 *   node --env-file=.env.local scripts/apply-fitment-api-billing-migration.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.join(__dirname, "..", "drizzle", "migrations", "0047_api_keys_stripe_billing.sql");

if (!process.env.POSTGRES_URL) {
  console.error("POSTGRES_URL is not set. Run with: node --env-file=.env.local scripts/apply-fitment-api-billing-migration.mjs");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sql = readFileSync(MIGRATION, "utf8");
  console.log(`Applying ${path.basename(MIGRATION)} ...`);
  await pool.query(sql);

  const { rows } = await pool.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'api_keys'
      AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'subscription_status')
    ORDER BY column_name
  `);
  console.table(rows);

  const { rows: idx } = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'api_keys' AND indexname LIKE 'api_keys_stripe_%'
    ORDER BY indexname
  `);
  console.log("Indexes:", idx.map((r) => r.indexname).join(", ") || "(none)");

  if (rows.length !== 3 || idx.length !== 2) {
    console.error("Migration verification failed: expected 3 columns and 2 indexes.");
    process.exit(1);
  }
  console.log("✓ Migration applied and verified.");
}

run()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
