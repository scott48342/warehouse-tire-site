import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const SOAP_NAMESPACE = "https://services.usautoforce.com";

function escapeXml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function buildSoapEnvelope(method, body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
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

// All USAF warehouse codes
const branches = [
  '4101', '4102', '4103', '4151', '4152', '4153', '4154', '4155', '4160', '4170', '4175',
  '4201', '4202', '4204', '4251', '4253', '4301', '4304', '4320', '4351',
  '4401', '4402', '4404', '4410', '4412', '4413', '4414', '4451', '4452', '4453', '4454', '4455', '4456',
  '4501', '4502', '4505', '4506', '4507', '4530', '4535',
  '4702', '4703', '4704', '4705', '4707', '4708', '4711', '4712', '4713', '4721',
  '4801', '4803', '4810', '4811', '4812', '4820', '4840', '4841', '4842', '4850',
  '4853', '4854', '4857', '4860', '4862', '4864'
];

const altBranchXml = branches.map(code => `<BranchDto><code>${code}</code></BranchDto>`).join('\n');

const transactionId = Date.now().toString();
const body = `<request>
  <revision>1.0</revision>
  <transactionId>${transactionId}</transactionId>
  <accountNumber>${escapeXml(process.env.USAUTOFORCE_ACCOUNT)}</accountNumber>
  <alternateFlag>yes</alternateFlag>
  <branch>4160</branch>
  <dataSource>manual</dataSource>
  <alternateBranches>
    ${altBranchXml}
  </alternateBranches>
  <parts>
    <PartDto>
      <lineNumber>1</lineNumber>
      <lineCode>HAN</lineCode>
      <partNumber>1034062</partNumber>
      <quantityRequested>4</quantityRequested>
    </PartDto>
  </parts>
</request>`;

const envelope = buildSoapEnvelope("StockCheck", body);

console.log('Searching all USAF warehouses for Hankook 1034062...\n');

const response = await fetch("https://services.usautoforce.com/integrationservice.asmx", {
  method: "POST",
  headers: {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": `${SOAP_NAMESPACE}/StockCheck`,
  },
  body: envelope,
});

const text = await response.text();

// Parse all branch quantities
const branchMatches = text.matchAll(/<BranchDto>([\s\S]*?)<\/BranchDto>/g);
const results = [];

for (const m of branchMatches) {
  const xml = m[1];
  const code = xml.match(/<code>([^<]+)<\/code>/)?.[1];
  const qty = parseInt(xml.match(/<quantityAvailable>(\d+)<\/quantityAvailable>/)?.[1] || '0');
  const name = xml.match(/<name>([^<]+)<\/name>/)?.[1];
  const city = xml.match(/<city>([^<]+)<\/city>/)?.[1];
  const state = xml.match(/<state>([^<]+)<\/state>/)?.[1];
  
  if (qty > 0) {
    results.push({ code, qty, name, city, state });
  }
}

// Sort by quantity descending
results.sort((a, b) => b.qty - a.qty);

console.log('=== Hankook Dynapro HT2 RH14 275/50R22 (1034062) ===\n');
console.log('Warehouses with stock:');
let totalQty = 0;
for (const r of results) {
  console.log(`  ${r.code}: ${r.qty} @ ${r.name || r.city}, ${r.state}`);
  totalQty += r.qty;
}
console.log(`\nTotal across all warehouses: ${totalQty}`);

if (totalQty >= 4) {
  console.log('\n✅ Enough inventory exists! May need to ship from multiple warehouses.');
} else {
  console.log('\n❌ Not enough inventory across all warehouses.');
}
