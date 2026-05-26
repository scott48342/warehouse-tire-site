const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/POSTGRES_URL=["']?([^"'\r\n]+)/);
if (!match) { console.log('No URL found'); process.exit(1); }

const client = new Client({ connectionString: match[1] });

async function main() {
  await client.connect();
  
  // Get all supplier orders
  const results = await client.query(`
    SELECT 
      so.order_id,
      so.supplier,
      so.supplier_order_number,
      so.status,
      so.tracking_numbers,
      so.error_message,
      so.created_at
    FROM supplier_orders so
    ORDER BY so.created_at DESC 
    LIMIT 10
  `);
  
  console.log('Recent Supplier Orders:\n');
  for (const row of results.rows) {
    console.log(`Order: ${row.order_id}`);
    console.log(`  Supplier: ${row.supplier}`);
    console.log(`  Supplier Order #: ${row.supplier_order_number || 'N/A'}`);
    console.log(`  Status: ${row.status}`);
    console.log(`  Tracking: ${JSON.stringify(row.tracking_numbers) || 'None'}`);
    console.log(`  Error: ${row.error_message || 'None'}`);
    console.log(`  Created: ${row.created_at}`);
    console.log('');
  }
  
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
