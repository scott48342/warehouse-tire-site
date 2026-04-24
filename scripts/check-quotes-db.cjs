const pg = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Get quotes table columns
  const { rows: cols } = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'quotes'
    ORDER BY ordinal_position
  `);
  console.log('=== QUOTES TABLE COLUMNS ===');
  console.log(cols.map(c => c.column_name).join(', '));
  console.log('');

  // Check all quotes
  const { rows: quotes } = await pool.query(`
    SELECT * FROM quotes 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  console.log('=== RECENT QUOTES ===');
  quotes.forEach((q, i) => {
    console.log(`${i + 1}. Quote ${q.id}`);
    console.log(`   Stripe Session: ${q.stripe_session_id || 'N/A'}`);
    console.log(`   Email: ${q.customer_email || 'N/A'}`);
    console.log(`   Created: ${q.created_at}`);
    console.log('');
  });
  console.log(`Total: ${quotes.length}`);
}

main().finally(() => pool.end());
