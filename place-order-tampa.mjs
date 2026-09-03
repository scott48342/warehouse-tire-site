import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const SOAP_NAMESPACE = "https://services.usautoforce.com";

function escapeXml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function buildSoapEnvelope(method, body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NAMESPACE}">
      <User>${escapeXml(process.env.USAUTOFORCE_USERNAME)}</User>
      <Password>${escapeXml(process.env.USAUTOFORCE_PASSWORD)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <${method} xmlns="${SOAP_NAMESPACE}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

// Get order details
const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const order = await client.query(`SELECT * FROM orders WHERE id = 'WTD-83UAXU'`);
const o = order.rows[0];
const snapshot = o.snapshot_json;

console.log('Order:', o.id);
console.log('Customer:', `${snapshot.customer.firstName} ${snapshot.customer.lastName}`);
console.log('Ship to:', `${snapshot.shippingAddress.address1}, ${snapshot.shippingAddress.city}, ${snapshot.shippingAddress.state} ${snapshot.shippingAddress.zip}`);

await client.end();

// Order items - Continental + Hankook
const orderItems = [
  { lineCode: 'CON', partNumber: '15501600000', quantity: 4, desc: 'Continental ProContact TX 235/45R18' },
  { lineCode: 'HAN', partNumber: '1034062', quantity: 4, desc: 'Hankook Dynapro HT2 RH14 275/50R22' },
];

console.log('\nOrder items:');
for (const item of orderItems) {
  console.log(`  ${item.quantity}x ${item.partNumber} (${item.lineCode}) - ${item.desc}`);
}

// Use TAMPA branch (4452) - closest to North Port, FL with 14 Hankook in stock
const BRANCH = '4452';
console.log(`\nUsing branch: ${BRANCH} (Tampa, FL - closest to customer)`);

// First check stock at Tampa for both items
console.log('\n--- Checking Tampa stock first ---');

const stockBody = `<request>
  <revision>1.0</revision>
  <transactionId>${Date.now()}</transactionId>
  <accountNumber>${escapeXml(process.env.USAUTOFORCE_ACCOUNT)}</accountNumber>
  <alternateFlag>no</alternateFlag>
  <branch>${BRANCH}</branch>
  <dataSource>manual</dataSource>
  <parts>
    <PartDto>
      <lineNumber>1</lineNumber>
      <lineCode>CON</lineCode>
      <partNumber>15501600000</partNumber>
      <quantityRequested>4</quantityRequested>
    </PartDto>
    <PartDto>
      <lineNumber>2</lineNumber>
      <lineCode>HAN</lineCode>
      <partNumber>1034062</partNumber>
      <quantityRequested>4</quantityRequested>
    </PartDto>
  </parts>
</request>`;

const stockEnvelope = buildSoapEnvelope("StockCheck", stockBody);
const stockResponse = await fetch("https://services.usautoforce.com/integrationservice.asmx", {
  method: "POST",
  headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": `${SOAP_NAMESPACE}/StockCheck` },
  body: stockEnvelope,
});
const stockText = await stockResponse.text();

// Parse stock
const partDtos = stockText.matchAll(/<PartDto>([\s\S]*?)<\/PartDto>/g);
for (const m of partDtos) {
  const xml = m[1];
  const pn = xml.match(/<partNumber>([^<]+)<\/partNumber>/)?.[1];
  const qty = xml.match(/<quantityAvailable>(\d+)<\/quantityAvailable>/)?.[1];
  console.log(`  ${pn}: ${qty} available at Tampa`);
}

// Place the order
console.log('\n--- Placing Order with USAF (Tampa branch) ---');

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
  <accountNumber>${escapeXml(process.env.USAUTOFORCE_ACCOUNT)}</accountNumber>
  <fillFlag>backord</fillFlag>
  <branch>${BRANCH}</branch>
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
    <billToCode>${escapeXml(process.env.USAUTOFORCE_ACCOUNT)}</billToCode>
  </billTo>
  <parts>${partsXml}
  </parts>
  <comments>
    <CommentDto>
      <type>vehicle</type>
      <text>Warehouse Tire Direct Order ${o.id}</text>
    </CommentDto>
  </comments>
</request>`;

const envelope = buildSoapEnvelope("Order", body);

const response = await fetch("https://services.usautoforce.com/integrationservice.asmx", {
  method: "POST",
  headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": `${SOAP_NAMESPACE}/Order` },
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
      status, items_json, ship_to_json, error_message, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
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
  console.log('\n--- Response excerpt ---');
  console.log(text.substring(0, 2500));
}
