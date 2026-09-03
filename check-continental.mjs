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

async function checkPart(partNumber, lineCode) {
  const transactionId = Date.now().toString();
  
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(accountNumber)}</accountNumber>
    <alternateFlag>yes</alternateFlag>
    <branch>4101</branch>
    <dataSource>manual</dataSource>
    <parts>
      <PartDto>
        <lineNumber>1</lineNumber>
        <lineCode>${escapeXml(lineCode)}</lineCode>
        <partNumber>${escapeXml(partNumber)}</partNumber>
        <quantityRequested>4</quantityRequested>
      </PartDto>
    </parts>
  </request>`;

  const envelope = buildSoapEnvelope("StockCheck", body, creds);

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
  const errorCode = text.match(/<errorCode>([^<]+)<\/errorCode>/)?.[1];
  
  // Get total quantity
  const qtyMatches = text.matchAll(/<quantityAvailable>(\d+)<\/quantityAvailable>/g);
  let totalQty = 0;
  for (const m of qtyMatches) {
    totalQty += parseInt(m[1]);
  }
  
  return { partNumber, lineCode, desc, cost, totalQty, errorCode };
}

console.log('=== Verifying parts for updated order ===\n');

// Continental ProContact TX (replacing Hankook Ventus)
const conti = await checkPart('15501600000', 'CON');
console.log('Continental ProContact TX (235/45R18):');
console.log('  Part#:', conti.partNumber);
console.log('  Description:', conti.desc);
console.log('  Cost: $' + conti.cost);
console.log('  Stock:', conti.totalQty);
console.log('  Status:', conti.errorCode);

// Hankook Dynapro HT2
const hankook = await checkPart('1034062', 'HAN');
console.log('\nHankook Dynapro HT2 RH14 (275/50R22):');
console.log('  Part#:', hankook.partNumber);
console.log('  Description:', hankook.desc);
console.log('  Cost: $' + hankook.cost);
console.log('  Stock:', hankook.totalQty);
console.log('  Status:', hankook.errorCode);

if (conti.totalQty >= 4 && hankook.totalQty >= 4) {
  console.log('\n✅ Both parts have sufficient stock for the order!');
} else {
  console.log('\n⚠️  Stock check:');
  if (conti.totalQty < 4) console.log('  - Continental: only ' + conti.totalQty + ' available (need 4)');
  if (hankook.totalQty < 4) console.log('  - Hankook: only ' + hankook.totalQty + ' available (need 4)');
}
