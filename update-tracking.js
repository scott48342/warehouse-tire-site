const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/POSTGRES_URL=["']?([^"'\r\n]+)/);
if (!match) { console.log('No URL found'); process.exit(1); }

const client = new Client({ connectionString: match[1] });

async function main() {
  await client.connect();
  
  // First check the column type
  const schema = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'supplier_orders' AND column_name = 'tracking_numbers'
  `);
  console.log('Column type:', schema.rows[0]?.data_type);
  
  const orderId = 'WTD-T5JT8F';
  const trackingNumbers = ['381479221397', '381479221401', '381479221412', '381479221423'];
  
  // Use PostgreSQL array literal format
  const result = await client.query(`
    UPDATE supplier_orders 
    SET 
      tracking_numbers = $1::text[],
      status = 'shipped',
      updated_at = NOW()
    WHERE order_id = $2 AND supplier = 'usautoforce'
    RETURNING *
  `, [trackingNumbers, orderId]);
  
  if (result.rows.length > 0) {
    console.log('✅ Updated supplier order:');
    console.log(`  Order ID: ${result.rows[0].order_id}`);
    console.log(`  Supplier: ${result.rows[0].supplier}`);
    console.log(`  USAF Order #: ${result.rows[0].supplier_order_number}`);
    console.log(`  Status: ${result.rows[0].status}`);
    console.log(`  Tracking: ${result.rows[0].tracking_numbers}`);
  } else {
    console.log('❌ No supplier order found to update');
  }
  
  // Also update the main order status
  const orderUpdate = await client.query(`
    UPDATE orders
    SET status = 'shipped', updated_at = NOW()
    WHERE id = $1
    RETURNING id, status
  `, [orderId]);
  
  if (orderUpdate.rows.length > 0) {
    console.log(`\n✅ Updated main order status to: ${orderUpdate.rows[0].status}`);
  }
  
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
