// Create an internal Fitment API key (for Shopify/Woo plugin dev testing). Prints plaintext key ONCE.
// Standalone (no Next path aliases) — mirrors generateApiKey()/hashApiKey() in src/lib/fitment-api/apiKeys.ts.
//   node --env-file=.env.local scripts/create-internal-api-key.mjs "Shopify dev test"
import { randomBytes, createHash } from 'crypto';
import pg from 'pg';

const name = process.argv[2] || 'Internal dev test';
const randomPart = randomBytes(32).toString('base64url').slice(0, 32);
const plainKey = `wtd_${randomPart}`;
const keyHash = createHash('sha256').update(plainKey).digest('hex');
const keyPrefix = `wtd_${randomPart.slice(0, 8)}`;

const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const { rows } = await p.query(
  `INSERT INTO api_keys (key_hash, key_prefix, name, email, company, plan, monthly_limit, active)
   VALUES ($1, $2, $3, $4, $5, 'starter', 10000, true) RETURNING id, key_prefix, plan, monthly_limit`,
  [keyHash, keyPrefix, name, 'scott@warehousetire.net', 'Warehouse Tire (internal)']
);
await p.end();
console.log(JSON.stringify({ ...rows[0], plainKey }, null, 2));
