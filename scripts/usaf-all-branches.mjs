/**
 * Query USAF and show ALL branch availability for Toyo tires
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

const size = process.argv[2] || '285/70R17';
const simpleSize = size.replace(/[^0-9]/g, '');
const width = simpleSize.slice(0, 3);
const aspect = simpleSize.slice(3, 5);
const rim = simpleSize.slice(5);

console.log(`Querying ALL branches for size: ${size}`);

const body = `<request>
  <revision>1.0</revision>
  <transactionId>${Date.now()}</transactionId>
  <accountNumber>${escapeXml(account)}</accountNumber>
  <alternateFlag>yes</alternateFlag>
  <branch>4101</branch>
  <dataSource>manual</dataSource>
  <tires>
    <TireDto>
      <lineNumber>1</lineNumber>
      <width>${width}</width>
      <aspectRatio>${aspect}</aspectRatio>
      <rim>${rim}</rim>
      <tireSize>${simpleSize}</tireSize>
      <quantityRequested>4</quantityRequested>
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
  
  // Collect all unique branches across all tires
  const allBranches = new Map();
  
  // Parse each TireDto
  const tireMatches = xml.matchAll(/<TireDto>([\s\S]*?)<\/TireDto>/g);
  
  for (const match of tireMatches) {
    const tireXml = match[1];
    const partNumber = tireXml.match(/<partNumber>([^<]+)<\/partNumber>/)?.[1];
    const brand = tireXml.match(/<brandCode>([^<]+)<\/brandCode>/)?.[1];
    const model = tireXml.match(/<model>([^<]+)<\/model>/)?.[1];
    
    // Only show Toyo
    if (!brand?.toUpperCase().includes('TOY') && !model?.toUpperCase().includes('TOYO')) continue;
    
    // Extract ALL branches
    const branchMatches = tireXml.matchAll(/<BranchDto>([\s\S]*?)<\/BranchDto>/g);
    
    for (const branchMatch of branchMatches) {
      const branchXml = branchMatch[1];
      const code = branchXml.match(/<code>([^<]+)<\/code>/)?.[1];
      const name = branchXml.match(/<name>([^<]+)<\/name>/)?.[1];
      const city = branchXml.match(/<city>([^<]+)<\/city>/)?.[1];
      const state = branchXml.match(/<state>([^<]+)<\/state>/)?.[1];
      const qty = parseInt(branchXml.match(/<quantityAvailable>([^<]+)<\/quantityAvailable>/)?.[1] || '0');
      
      if (!allBranches.has(code)) {
        allBranches.set(code, { code, name, city, state, tires: [] });
      }
      
      if (qty > 0) {
        allBranches.get(code).tires.push({ partNumber, model, qty });
      }
    }
  }
  
  // Print branches sorted by state
  const sorted = [...allBranches.values()].sort((a, b) => {
    if (a.state === b.state) return a.city.localeCompare(b.city);
    return a.state.localeCompare(b.state);
  });
  
  console.log('\n=== ALL USAF BRANCHES WITH TOYO TIRES ===\n');
  
  for (const branch of sorted) {
    if (branch.tires.length === 0) continue;
    console.log(`Branch ${branch.code}: ${branch.name} - ${branch.city}, ${branch.state}`);
    for (const tire of branch.tires) {
      console.log(`  ${tire.partNumber} ${tire.model}: ${tire.qty} in stock`);
    }
    console.log('');
  }
  
} catch (err) {
  console.error('Error:', err.message);
}
