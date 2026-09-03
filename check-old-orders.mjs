import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Check for those order numbers
console.log('=== Looking for successful test orders ===\n');

const result = await client.query(`
  SELECT * FROM supplier_orders 
  WHERE supplier_order_number LIKE 'HDS%'
  ORDER BY created_at
`);

console.log('Found', result.rows.length, 'USAF orders with HDS prefix\n');

for (const row of result.rows) {
  console.log('---');
  console.log('Order ID:', row.order_id);
  console.log('Supplier Order #:', row.supplier_order_number);
  console.log('PO:', row.supplier_po);
  console.log('Status:', row.status);
  console.log('Created:', row.created_at);
  console.log('Items:', JSON.stringify(row.items_json, null, 2));
  console.log('Ship To:', JSON.stringify(row.ship_to_json, null, 2));
  console.log('Error:', row.error_message || 'none');
}

// Also check the one successful order we found earlier
console.log('\n=== Previous successful order (HDS26692934) ===');
const prev = await client.query(`
  SELECT * FROM supplier_orders 
  WHERE supplier_order_number = 'HDS26692934'
`);

if (prev.rows[0]) {
  const row = prev.rows[0];
  console.log('Order ID:', row.order_id);
  console.log('Items:', JSON.stringify(row.items_json, null, 2));
}

await client.end();
