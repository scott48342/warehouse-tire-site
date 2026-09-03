import pg from 'pg';
import * as dotenv from 'dotenv';

// Load production env
dotenv.config({ path: '.env.production' });

console.log('Using USAF credentials:');
console.log('  Username:', process.env.USAUTOFORCE_USERNAME);
console.log('  Account:', process.env.USAUTOFORCE_ACCOUNT);

// Get the order details
const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL,
});

await client.connect();

const order = await client.query(`SELECT * FROM orders WHERE id = 'WTD-83UAXU'`);
const o = order.rows[0];
const snapshot = o.snapshot_json;

console.log('\nOrder:', o.id);
console.log('Customer:', `${snapshot.customer.firstName} ${snapshot.customer.lastName}`);
console.log('Ship to:', JSON.stringify(snapshot.shippingAddress));

// Items
const items = [];
for (const line of snapshot.lines) {
  if (line.meta?.cartType === 'tire' && line.meta?.source === 'usautoforce') {
    items.push({
      partNumber: line.sku,
      quantity: line.qty,
      brand: line.meta.brand,
      name: line.name,
    });
    console.log(`  ${line.qty}x ${line.sku} (${line.meta.brand}) - ${line.name}`);
  }
}

await client.end();

// Import the USAF client
const { placeOrder, testConnection, checkStockBySize } = await import('./src/lib/usautoforce/client.ts');
const { getUSAFBrandCode } = await import('./src/lib/usautoforce/brandCodes.ts');

// Verify connection first
console.log('\n--- Verifying Connection ---');
const test = await testConnection();
if (!test.serviceCheckResult?.success) {
  console.error('Connection failed:', test.message);
  process.exit(1);
}
console.log('✓ Connected to', test.message);

// Map brands to USAF line codes
console.log('\n--- Preparing Order Items ---');
const orderItems = items.map(item => {
  const lineCode = getUSAFBrandCode(item.brand);
  console.log(`  ${item.brand} -> lineCode ${lineCode}`);
  return {
    partNumber: item.partNumber,
    quantity: item.quantity,
    lineCode,
  };
});

console.log('\n--- Placing Order ---');
const result = await placeOrder({
  purchaseOrderNumber: `WTD-${o.id}`,
  items: orderItems,
  shipTo: {
    name: `${snapshot.customer.firstName} ${snapshot.customer.lastName}`,
    address1: snapshot.shippingAddress.address1,
    address2: snapshot.shippingAddress.address2,
    city: snapshot.shippingAddress.city,
    state: snapshot.shippingAddress.state,
    zip: snapshot.shippingAddress.zip,
    phone: snapshot.customer.phone,
  },
  notes: `Warehouse Tire Direct Order ${o.id}`,
});

console.log('\n--- RESULT ---');
console.log(JSON.stringify(result, null, 2));

if (result.success) {
  console.log('\n✅ ORDER PLACED SUCCESSFULLY!');
  console.log('USAF Order #:', result.orderNumber);
  
  // Insert into supplier_orders table
  const db = new pg.Client({
    connectionString: process.env.POSTGRES_URL,
  });
  await db.connect();
  
  await db.query(`
    INSERT INTO supplier_orders (
      order_id, supplier, supplier_order_number, supplier_po,
      status, items_json, ship_to_json, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    o.id,
    'usautoforce',
    result.orderNumber,
    `WTD-${o.id}`,
    'placed',
    JSON.stringify(orderItems),
    JSON.stringify(snapshot.shippingAddress),
    null,
  ]);
  
  console.log('✅ Saved to supplier_orders table');
  await db.end();
} else {
  console.log('\n❌ ORDER FAILED');
  console.log('Error:', result.errorMessage);
}
