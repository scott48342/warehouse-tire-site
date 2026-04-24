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
  // Check quotes table
  console.log('=== QUOTES FOR vince.loves.corrine@gmail.com ===\n');
  const { rows: quotes } = await pool.query(`
    SELECT * FROM quotes 
    WHERE customer_email ILIKE '%vince%'
    ORDER BY created_at DESC
  `);
  
  quotes.forEach((q, i) => {
    console.log(`Quote ${i + 1}:`);
    console.log(`  ID: ${q.id}`);
    console.log(`  Name: ${q.customer_first} ${q.customer_last}`);
    console.log(`  Email: ${q.customer_email}`);
    console.log(`  Phone: ${q.customer_phone || 'N/A'}`);
    console.log(`  Vehicle: ${q.vehicle_label}`);
    console.log(`  Created: ${q.created_at}`);
    console.log(`  Snapshot: ${JSON.stringify(q.snapshot_json, null, 2).slice(0, 500)}...`);
    console.log('');
  });

  // Check abandoned carts
  console.log('=== ABANDONED CARTS FOR vince ===\n');
  const { rows: carts } = await pool.query(`
    SELECT * FROM abandoned_carts 
    WHERE customer_email ILIKE '%vince%'
    ORDER BY created_at DESC
  `);
  
  if (carts.length === 0) {
    console.log('No abandoned carts found');
  } else {
    carts.forEach((c, i) => {
      console.log(`Cart ${i + 1}:`);
      console.log(`  ID: ${c.id}`);
      console.log(`  Email: ${c.customer_email}`);
      console.log(`  Phone: ${c.customer_phone || 'N/A'}`);
      console.log(`  Status: ${c.status}`);
      console.log(`  Created: ${c.created_at}`);
      console.log('');
    });
  }
}

main().finally(() => pool.end());
