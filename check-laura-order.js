const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/POSTGRES_URL=["']?([^"'\r\n]+)/);
if (!match) { console.log('No URL found'); process.exit(1); }

const client = new Client({ connectionString: match[1] });

async function main() {
  await client.connect();
  
  // Find Laura's orders - search in customer_email or snapshot_json
  const orders = await client.query(`
    SELECT 
      o.id,
      o.customer_email,
      o.customer_phone,
      o.status,
      o.created_at,
      o.snapshot_json
    FROM orders o
    WHERE 
      LOWER(o.customer_email) LIKE '%laura%' 
      OR o.snapshot_json::text ILIKE '%laura%'
    ORDER BY o.created_at DESC 
    LIMIT 5
  `);
  
  console.log('=== Orders for Laura ===\n');
  
  for (const order of orders.rows) {
    const snapshot = order.snapshot_json || {};
    console.log(`Order ID: ${order.id}`);
    console.log(`  Email: ${order.customer_email}`);
    console.log(`  Phone: ${order.customer_phone}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Created: ${order.created_at}`);
    if (snapshot.shippingAddress) {
      console.log(`  Shipping: ${JSON.stringify(snapshot.shippingAddress)}`);
    }
    
    // Get supplier orders for this order
    const supplierOrders = await client.query(`
      SELECT 
        supplier,
        supplier_order_number,
        status,
        tracking_numbers,
        error_message,
        created_at
      FROM supplier_orders
      WHERE order_id = $1
    `, [order.id]);
    
    if (supplierOrders.rows.length > 0) {
      console.log('  Supplier Orders:');
      for (const so of supplierOrders.rows) {
        console.log(`    - ${so.supplier}: ${so.supplier_order_number || 'no order#'}`);
        console.log(`      Status: ${so.status}`);
        console.log(`      Tracking: ${JSON.stringify(so.tracking_numbers) || 'none'}`);
        if (so.error_message) console.log(`      Error: ${so.error_message}`);
      }
    } else {
      console.log('  No supplier orders found');
    }
    console.log('');
  }
  
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
