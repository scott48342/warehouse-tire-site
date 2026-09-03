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

// Try with alternateFlag=yes and a wider range of branches
const partNumber = '1034062';
const lineCode = 'HAN';
const transactionId = Date.now().toString();

// Include a LOT more branch codes
const allBranches = [];
for (let i = 4100; i <= 4150; i++) {
  allBranches.push(i.toString());
}
// Also try some other common branch number ranges
for (let i = 1000; i <= 1020; i++) {
  allBranches.push(i.toString());
}

const altXml = allBranches.map(code => `<BranchDto><code>${code}</code></BranchDto>`).join('\n');

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

console.log(`Checking part# ${partNumber} across ${allBranches.length} branches...`);

const response = await fetch("https://services.usautoforce.com/integrationservice.asmx", {
  method: "POST",
  headers: {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": `${SOAP_NAMESPACE}/StockCheck`,
  },
  body: envelope,
});

const text = await response.text();
console.log('Response length:', text.length);

// Parse all branch quantities
const branchMatches = text.matchAll(/<BranchDto>([\s\S]*?)<\/BranchDto>/g);
let totalQty = 0;
const branchesWithStock = [];

for (const m of branchMatches) {
  const xml = m[1];
  const code = xml.match(/<code>([^<]+)<\/code>/)?.[1];
  const qty = parseInt(xml.match(/<quantityAvailable>(\d+)<\/quantityAvailable>/)?.[1] || '0');
  const name = xml.match(/<name>([^<]+)<\/name>/)?.[1];
  const city = xml.match(/<city>([^<]+)<\/city>/)?.[1];
  const state = xml.match(/<state>([^<]+)<\/state>/)?.[1];
  
  totalQty += qty;
  if (qty > 0) {
    branchesWithStock.push({ code, qty, name, city, state });
  }
}

console.log('\n=== Part# 1034062 (Dynapro HT2 RH14 275/50R22) ===');
console.log('Total inventory found:', totalQty);

if (branchesWithStock.length > 0) {
  console.log('\nBranches with stock:');
  for (const b of branchesWithStock) {
    console.log(`  ${b.code}: ${b.qty} @ ${b.name} (${b.city}, ${b.state})`);
  }
} else {
  console.log('No branches with stock found in the queried range.');
  
  // Print raw response excerpt to debug
  console.log('\n--- Raw PartDto from response ---');
  const partDto = text.match(/<PartDto>([\s\S]*?)<\/PartDto>/)?.[0];
  console.log(partDto?.substring(0, 2000) || 'No PartDto found');
}
