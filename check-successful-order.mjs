import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Get the successful order details
const result = await client.query(`
  SELECT o.*, so.* 
  FROM orders o
  JOIN supplier_orders so ON o.id = so.order_id
  WHERE so.supplier_order_number = 'HDS26692934'
`);

const row = result.rows[0];
console.log('=== SUCCESSFUL ORDER: HDS26692934 ===\n');
console.log('Our Order ID:', row.order_id);
console.log('Created:', row.created_at);
console.log('Status:', row.status);
console.log('Supplier PO:', row.supplier_po);
console.log('\nItems ordered:');
console.log(JSON.stringify(row.items_json, null, 2));
console.log('\nShip To:');
console.log(JSON.stringify(row.ship_to_json, null, 2));

await client.end();

// Now let's check the stock for that part number that worked
console.log('\n=== Checking stock for the WORKING part (28951674 FAL) ===');

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

const transactionId = Date.now().toString();
const body = `<request>
  <revision>1.0</revision>
  <transactionId>${transactionId}</transactionId>
  <accountNumber>${process.env.USAUTOFORCE_ACCOUNT}</accountNumber>
  <alternateFlag>yes</alternateFlag>
  <branch>4101</branch>
  <dataSource>manual</dataSource>
  <parts>
    <PartDto>
      <lineNumber>1</lineNumber>
      <lineCode>FAL</lineCode>
      <partNumber>28951674</partNumber>
      <quantityRequested>4</quantityRequested>
    </PartDto>
  </parts>
</request>`;

const envelope = buildSoapEnvelope("StockCheck", body);

const response = await fetch("https://services.usautoforce.com/integrationservice.asmx", {
  method: "POST",
  headers: {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": `${SOAP_NAMESPACE}/StockCheck`,
  },
  body: envelope,
});

const text = await response.text();
const desc = text.match(/<description>([^<]+)<\/description>/)?.[1] || 'N/A';
const cost = text.match(/<cost>([^<]+)<\/cost>/)?.[1] || '0';
const qtyMatches = text.matchAll(/<quantityAvailable>(\d+)<\/quantityAvailable>/g);
let totalQty = 0;
for (const m of qtyMatches) totalQty += parseInt(m[1]);

console.log('Part# 28951674 (Falken):');
console.log('  Description:', desc);
console.log('  Cost: $' + cost);
console.log('  Total Stock:', totalQty);
