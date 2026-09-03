/**
 * Query USAF with specific branch as primary to get its info from response
 */
import 'dotenv/config';

const PROD_URL = 'https://services.usautoforce.com/integrationservice.asmx';
const SOAP_NS = 'https://services.usautoforce.com';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const username = process.env.USAUTOFORCE_USERNAME;
const password = process.env.USAUTOFORCE_PASSWORD;
const account = process.env.USAUTOFORCE_ACCOUNT;

// Known branches to query
const knownBranches = [
  4101, // Appleton (main warehouse)
  4160, // Wixom, MI
];

// Try common branch code patterns
const guesses = [];
for (let i = 4100; i <= 4200; i++) guesses.push(i);
for (let i = 4500; i <= 4600; i++) guesses.push(i);
for (let i = 4700; i <= 4900; i++) guesses.push(i);

const allBranches = [...new Set([...knownBranches, ...guesses])];

console.log(`Testing ${allBranches.length} branch codes...\n`);

const found = [];

for (const branchCode of allBranches) {
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${Date.now()}</transactionId>
    <accountNumber>${escapeXml(account)}</accountNumber>
    <alternateFlag>no</alternateFlag>
    <branch>${branchCode}</branch>
    <dataSource>manual</dataSource>
    <tires>
      <TireDto>
        <lineNumber>1</lineNumber>
        <width>265</width>
        <aspectRatio>70</aspectRatio>
        <rim>17</rim>
        <tireSize>2657017</tireSize>
        <quantityRequested>1</quantityRequested>
      </TireDto>
    </tires>
  </request>`;

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NS}">
      <User>${escapeXml(username)}</User>
      <Password>${escapeXml(password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <StockCheck xmlns="${SOAP_NS}">
      ${body}
    </StockCheck>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch(PROD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `${SOAP_NS}/StockCheck`,
      },
      body: envelope,
    });

    const xml = await response.text();
    
    // Check for error
    const errorMatch = xml.match(/<errorCode>([^<]*)<\/errorCode>/);
    if (errorMatch && errorMatch[1] === 'fail') {
      continue; // Invalid branch
    }
    
    // Extract branch info from any BranchDto
    const branchMatches = [...xml.matchAll(/<BranchDto>[\s\S]*?<code>(\d+)<\/code>[\s\S]*?<name>([^<]*)<\/name>[\s\S]*?<address>([^<]*)<\/address>[\s\S]*?<city>([^<]*)<\/city>[\s\S]*?<state>([^<]*)<\/state>[\s\S]*?<zip>([^<]*)<\/zip>[\s\S]*?<\/BranchDto>/g)];
    
    for (const match of branchMatches) {
      const [, code, name, address, city, state, zip] = match;
      if (!found.find(b => b.code === code)) {
        found.push({ code, name, address, city, state, zip });
        console.log(`✓ ${code}: ${name} - ${address}, ${city}, ${state} ${zip}`);
      }
    }
    
  } catch (err) {
    // Skip
  }
  
  // Rate limit
  await new Promise(r => setTimeout(r, 50));
}

console.log(`\n=== Found ${found.length} branches ===\n`);
console.log(JSON.stringify(found, null, 2));
