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
  const { rows } = await pool.query(`
    SELECT 
      id,
      status,
      customer_email,
      amount_paid_cents,
      paid_at,
      created_at,
      snapshot_json->'customer' as customer,
      snapshot_json->'vehicle' as vehicle
    FROM orders
    ORDER BY created_at DESC
    LIMIT 10
  `);
  
  console.log('=== ORDERS IN DATABASE ===\n');
  rows.forEach((row, i) => {
    console.log(`${i + 1}. Order: ${row.id}`);
    console.log(`   Status: ${row.status}`);
    console.log(`   Email: ${row.customer_email}`);
    console.log(`   Amount: $${(row.amount_paid_cents / 100).toFixed(2)}`);
    console.log(`   Paid: ${row.paid_at || 'N/A'}`);
    console.log(`   Created: ${row.created_at}`);
    console.log(`   Customer: ${JSON.stringify(row.customer)}`);
    console.log(`   Vehicle: ${JSON.stringify(row.vehicle)}`);
    console.log('');
  });
  
  console.log(`Total: ${rows.length} orders`);
}

main().finally(() => pool.end());
