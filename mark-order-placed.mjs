// Run this AFTER you manually place the order on USAF website
// Usage: node mark-order-placed.mjs <USAF_ORDER_NUMBER>
// Example: node mark-order-placed.mjs HDS12345678

import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const usafOrderNumber = process.argv[2];

if (!usafOrderNumber) {
  console.log('Usage: node mark-order-placed.mjs <USAF_ORDER_NUMBER>');
  console.log('Example: node mark-order-placed.mjs HDS12345678');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const orderId = 'WTD-83UAXU';

// Items that were ordered (updated: Continental instead of Hankook Ventus)
const items = [
  { lineCode: 'CON', partNumber: '15501600000', quantity: 4, desc: 'Continental ProContact TX 235/45R18' },
  { lineCode: 'HAN', partNumber: '1034062', quantity: 4, desc: 'Hankook Dynapro HT2 RH14 275/50R22' },
];

// Get shipping address from order
const order = await client.query(`SELECT snapshot_json FROM orders WHERE id = $1`, [orderId]);
const snapshot = order.rows[0].snapshot_json;

// Insert supplier order record
await client.query(`
  INSERT INTO supplier_orders (
    order_id, supplier, supplier_order_number, supplier_po,
    status, items_json, ship_to_json, error_message, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
`, [
  orderId,
  'usautoforce',
  usafOrderNumber,
  `WTD-${orderId}`,
  'placed',
  JSON.stringify(items),
  JSON.stringify(snapshot.shippingAddress),
  null,
]);

console.log(`✅ Recorded USAF order ${usafOrderNumber} for ${orderId}`);
console.log('Items:', items.map(i => `${i.quantity}x ${i.partNumber}`).join(', '));

await client.end();
