import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const SOAP_NAMESPACE = "https://services.usautoforce.com";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(method, body, creds) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NAMESPACE}">
      <User>${escapeXml(creds.username)}</User>
      <Password>${escapeXml(creds.password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <${method} xmlns="${SOAP_NAMESPACE}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

const creds = {
  username: process.env.USAUTOFORCE_USERNAME,
  password: process.env.USAUTOFORCE_PASSWORD,
};
const accountNumber = process.env.USAUTOFORCE_ACCOUNT;

// Get original order info
const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const order = await client.query(`SELECT * FROM orders WHERE id = 'WTD-83UAXU'`);
const o = order.rows[0];
const snapshot = o.snapshot_json;

console.log('Order:', o.id);
console.log('Customer:', `${snapshot.customer.firstName} ${snapshot.customer.lastName}`);
console.log('Ship to:', `${snapshot.shippingAddress.address1}, ${snapshot.shippingAddress.city}, ${snapshot.shippingAddress.state} ${snapshot.shippingAddress.zip}`);

await client.end();

// Updated order items:
// - Replace Hankook Ventus S1 AS H125 (1038485) with Continental ProContact TX (15501600000)
// - Keep Hankook Dynapro HT2 RH14 (1034062)
const orderItems = [
  { lineCode: 'CON', partNumber: '15501600000', quantity: 4, desc: 'Continental ProContact TX 235/45R18' },
  { lineCode: 'HAN', partNumber: '1034062', quantity: 4, desc: 'Hankook Dynapro HT2 RH14 275/50R22' },
];

console.log('\nOrder items:');
for (const item of orderItems) {
  console.log(`  ${item.quantity}x ${item.partNumber} (${item.lineCode}) - ${item.desc}`);
}

// Build order XML
const transactionId = Date.now().toString();
const poNumber = `WTD-${o.id}`;

const partsXml = orderItems.map((item, idx) => `
    <PartDto>
      <lineNumber>${idx + 1}</lineNumber>
      <lineCode>${escapeXml(item.lineCode)}</lineCode>
      <partNumber>${escapeXml(item.partNumber)}</partNumber>
      <quantityRequested>${item.quantity}</quantityRequested>
    </PartDto>`).join('');

const body = `<request>
  <revision>1.0</revision>
  <transactionId>${transactionId}</transactionId>
  <accountNumber>${escapeXml(accountNumber)}</accountNumber>
  <fillFlag>backord</fillFlag>
  <branch>4101</branch>
  <poNumber>${escapeXml(poNumber)}</poNumber>
  <deliveryMethod>FedEx-Grou</deliveryMethod>
  <shipTo>
    <shipToCode>99999</shipToCode>
    <customerName>${escapeXml(`${snapshot.customer.firstName} ${snapshot.customer.lastName}`)}</customerName>
    <address1>${escapeXml(snapshot.shippingAddress.address1)}</address1>
    <city>${escapeXml(snapshot.shippingAddress.city)}</city>
    <state>${escapeXml(snapshot.shippingAddress.state)}</state>
    <zip>${escapeXml(snapshot.shippingAddress.zip)}</zip>
  </shipTo>
  <billTo>
    <billToCode>${escapeXml(accountNumber)}</billToCode>
  </billTo>
  <parts>${partsXml}
  </parts>
  <comments>
    <CommentDto>
      <type>vehicle</type>
      <text>Warehouse Tire Direct Order ${o.id} - Updated: Hankook Ventus replaced with Continental ProContact TX</text>
    </CommentDto>
  </comments>
</request>`;

const envelope = buildSoapEnvelope("Order", body, creds);

console.log('\n--- Placing Order with USAF ---');

const response = await fetch("https://services.usautoforce.com/integrationservice.asmx", {
  method: "POST",
  headers: {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": `${SOAP_NAMESPACE}/Order`,
  },
  body: envelope,
});

const text = await response.text();

const errorCode = text.match(/<errorCode>([^<]+)<\/errorCode>/)?.[1];
const errorMessage = text.match(/<errorMessage>([^<]+)<\/errorMessage>/)?.[1];
const orderNumber = text.match(/<orderNumber>([^<]+)<\/orderNumber>/)?.[1];

console.log('Response:');
console.log('  errorCode:', errorCode);
console.log('  errorMessage:', errorMessage);
console.log('  orderNumber:', orderNumber || 'none');

if (errorCode === 'success' && orderNumber) {
  console.log('\n✅ ORDER PLACED SUCCESSFULLY!');
  console.log('USAF Order #:', orderNumber);
  
  // Save to supplier_orders table
  const db = new pg.Client({ connectionString: process.env.POSTGRES_URL });
  await db.connect();
  
  await db.query(`
    INSERT INTO supplier_orders (
      order_id, supplier, supplier_order_number, supplier_po,
      status, items_json, ship_to_json, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    o.id,
    'usautoforce',
    orderNumber,
    poNumber,
    'placed',
    JSON.stringify(orderItems),
    JSON.stringify(snapshot.shippingAddress),
    null,
  ]);
  
  console.log('✅ Saved to supplier_orders table');
  await db.end();
} else {
  console.log('\n❌ ORDER FAILED');
  
  // Print more of the response to debug
  console.log('\n--- Response excerpt ---');
  console.log(text.substring(0, 2000));
}
