/**
 * Phase 1 Migration: Cart Recovery Consent + Checkout Diagnostics
 *
 * Creates two NEW tables (fully backward compatible - no existing tables
 * or columns are modified):
 *   - cart_recovery_consents: dedicated consent for cart recovery emails
 *   - checkout_diagnostics: privacy-safe checkout funnel diagnostics
 *
 * Idempotent: safe to run multiple times (IF NOT EXISTS everywhere).
 *
 * Usage: node scripts/migrations/2026-08-03-phase1-consent-diagnostics.mjs
 * Requires POSTGRES_URL in .env.local (or env)
 *
 * @created 2026-08-03
 */

import pg from "pg";
import fs from "fs";
import path from "path";

function getDbUrl() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const envPath = path.join(process.cwd(), ".env.local");
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    .find((l) => l.startsWith("POSTGRES_URL="));
  if (!line) throw new Error("POSTGRES_URL not found");
  return line.replace(/^POSTGRES_URL="?([^"]+)"?$/, "$1");
}

const pool = new pg.Pool({
  connectionString: getDbUrl(),
  ssl: { rejectUnauthorized: false },
  max: 2,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS cart_recovery_consents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL UNIQUE,
    cart_id varchar(100),
    session_id varchar(100),
    consented boolean NOT NULL DEFAULT true,
    consent_source varchar(100) NOT NULL,
    consent_wording_version varchar(100) NOT NULL,
    consented_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    revoked_source varchar(100),
    ip_address varchar(45),
    user_agent text,
    is_test boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS cart_recovery_consents_email_idx ON cart_recovery_consents (email)`,
  `CREATE INDEX IF NOT EXISTS cart_recovery_consents_cart_id_idx ON cart_recovery_consents (cart_id)`,

  `CREATE TABLE IF NOT EXISTS checkout_diagnostics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id varchar(100),
    session_id varchar(100),
    device_type varchar(20),
    browser varchar(120),
    site_mode varchar(20),
    checkout_step varchar(50),
    event_type varchar(60) NOT NULL,
    status varchar(20),
    endpoint varchar(200),
    http_status integer,
    error_code varchar(120),
    detail json,
    page_url text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS checkout_diagnostics_cart_id_idx ON checkout_diagnostics (cart_id)`,
  `CREATE INDEX IF NOT EXISTS checkout_diagnostics_event_type_idx ON checkout_diagnostics (event_type)`,
  `CREATE INDEX IF NOT EXISTS checkout_diagnostics_created_at_idx ON checkout_diagnostics (created_at)`,
];

console.log("Phase 1 migration: cart_recovery_consents + checkout_diagnostics");
for (const stmt of statements) {
  const label = stmt.trim().split("\n")[0].slice(0, 80);
  await pool.query(stmt);
  console.log(`  OK: ${label}`);
}

// Verify
const { rows } = await pool.query(`
  SELECT table_name, COUNT(*) AS cols
  FROM information_schema.columns
  WHERE table_name IN ('cart_recovery_consents', 'checkout_diagnostics')
  GROUP BY table_name ORDER BY table_name
`);
console.log("Verification:", rows);

await pool.end();
console.log("Migration complete.");
