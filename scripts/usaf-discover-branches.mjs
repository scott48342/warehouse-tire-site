/**
 * Discover USAF branch codes by trying different codes and seeing what data comes back
 * We know 4101 = Appleton, 4160 = Wixom
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

// Try a range of branch codes to discover which ones exist
const branchesToTry = [];

// Start with known codes
branchesToTry.push(4101); // Appleton
branchesToTry.push(4160); // Wixom

// Try a range around those
for (let i = 4100; i <= 4200; i++) {
  if (!branchesToTry.includes(i)) branchesToTry.push(i);
}

// Also try 4001-4099, 4201-4300, 4301-4400, etc
for (let i = 4001; i <= 4999; i += 100) {
  for (let j = 0; j < 100; j++) {
    const code = i + j;
    if (!branchesToTry.includes(code)) branchesToTry.push(code);
  }
}

console.log(`Testing ${branchesToTry.length} branch codes...`);

const discoveredBranches = [];

for (const branchCode of branchesToTry) {
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
        <width>285</width>
        <aspectRatio>70</aspectRatio>
        <rim>17</rim>
        <tireSize>2857017</tireSize>
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
    
    // Look for branch info in response
    const branchMatch = xml.match(/<BranchDto>[\s\S]*?<code>(\d+)<\/code>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<city>([^<]+)<\/city>[\s\S]*?<state>([^<]+)<\/state>[\s\S]*?<zip>([^<]+)<\/zip>[\s\S]*?<\/BranchDto>/);
    
    if (branchMatch) {
      const [, code, name, city, state, zip] = branchMatch;
      // Only add if we haven't seen this branch
      if (!discoveredBranches.find(b => b.code === code)) {
        discoveredBranches.push({ code, name, city, state, zip });
        console.log(`Found: ${code} - ${name}, ${city}, ${state} ${zip}`);
      }
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 100));
    
  } catch (err) {
    // Skip errors
  }
}

console.log('\n=== DISCOVERED BRANCHES ===');
console.log(JSON.stringify(discoveredBranches, null, 2));
