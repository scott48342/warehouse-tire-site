const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Adding issuer column to auth_accounts...');
  
  // Add issuer column if it doesn't exist
  await pool.query(`
    ALTER TABLE auth_accounts 
    ADD COLUMN IF NOT EXISTS issuer TEXT
  `);
  console.log('Added issuer column (nullable)');
  
  // Backfill existing accounts: credential accounts use 'local:credential'
  // Since we only have email/password auth, all accounts are credential type
  await pool.query(`
    UPDATE auth_accounts 
    SET issuer = 'local:credential' 
    WHERE issuer IS NULL AND provider_id = 'credential'
  `);
  console.log('Backfilled credential accounts');
  
  // Make issuer NOT NULL (Better Auth 1.7 requirement)
  // Note: Need to ensure all rows have a value first
  // For any remaining NULL values, use a default based on provider_id
  await pool.query(`
    UPDATE auth_accounts 
    SET issuer = CONCAT('local:oauth:', provider_id) 
    WHERE issuer IS NULL
  `);
  console.log('Backfilled remaining accounts');
  
  // Now make it NOT NULL
  await pool.query(`
    ALTER TABLE auth_accounts 
    ALTER COLUMN issuer SET NOT NULL
  `);
  console.log('Made issuer NOT NULL');
  
  // Create unique compound index (Better Auth 1.7 requirement)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_issuer_account_id_idx 
    ON auth_accounts (issuer, account_id)
  `);
  console.log('Created compound index on issuer + account_id');
  
  // Verify
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'auth_accounts' AND column_name = 'issuer'
  `);
  console.log('Issuer column:', result.rows[0]);
  
  await pool.end();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
