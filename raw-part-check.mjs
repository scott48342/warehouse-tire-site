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
  
  // Include ALL major USAF warehouses
  const alternateBranches = ['4102', '4103', '4104', '4105', '4106', '4107', '4108', '4109', '4110', '4111', '4112'];
  const altXml = alternateBranches.map(code => `<BranchDto><code>${code}</code></BranchDto>`).join('\n');

  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(accountNumber)}</accountNumber>
    <alternateFlag>yes</alternateFlag>
    <branch>4101</branch>
    <dataSource>manual</dataSource>
    <alternateBranches>
      ${altXml}
    </alternateBranches>
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
  
  // Parse description
  const desc = text.match(/<description>([^<]+)<\/description>/)?.[1] || 'N/A';
  const cost = text.match(/<cost>([^<]+)<\/cost>/)?.[1] || '0';
  
  // Parse all branch quantities
  const branchMatches = text.matchAll(/<BranchDto>([\s\S]*?)<\/BranchDto>/g);
  const branches = [];
  for (const m of branchMatches) {
    const xml = m[1];
    const code = xml.match(/<code>([^<]+)<\/code>/)?.[1];
    const qty = xml.match(/<quantityAvailable>(\d+)<\/quantityAvailable>/)?.[1];
    const name = xml.match(/<name>([^<]+)<\/name>/)?.[1];
    const city = xml.match(/<city>([^<]+)<\/city>/)?.[1];
    const state = xml.match(/<state>([^<]+)<\/state>/)?.[1];
    if (code && qty) {
      branches.push({ code, qty: parseInt(qty), name, location: `${city}, ${state}` });
    }
  }
  
  return { partNumber, desc, cost, branches };
}

console.log('=== Checking Part# 1038485 (Ventus S1 AS H125 235/45R18) ===');
const r1 = await checkPart('1038485', 'HAN');
console.log('Description:', r1.desc);
console.log('Cost: $' + r1.cost);
console.log('Inventory by warehouse:');
for (const b of r1.branches) {
  if (b.qty > 0) {
    console.log(`  ✓ ${b.code} (${b.name} - ${b.location}): ${b.qty} in stock`);
  }
}
const total1 = r1.branches.reduce((sum, b) => sum + b.qty, 0);
console.log(`TOTAL: ${total1}`);

console.log('\n=== Checking Part# 1034062 (Dynapro HT2 RH14 275/50R22) ===');
const r2 = await checkPart('1034062', 'HAN');
console.log('Description:', r2.desc);
console.log('Cost: $' + r2.cost);
console.log('Inventory by warehouse:');
for (const b of r2.branches) {
  if (b.qty > 0) {
    console.log(`  ✓ ${b.code} (${b.name} - ${b.location}): ${b.qty} in stock`);
  }
}
const total2 = r2.branches.reduce((sum, b) => sum + b.qty, 0);
console.log(`TOTAL: ${total2}`);
