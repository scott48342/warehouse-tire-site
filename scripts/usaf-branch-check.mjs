/**
 * Check USAF branch availability for a specific tire
 * Usage: node scripts/usaf-branch-check.mjs <size> [partNumber]
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

if (!username || !password || !account) {
  console.error('Missing USAF credentials');
  process.exit(1);
}

const size = process.argv[2] || '285/70R17';
const partNumberFilter = process.argv[3] || null;
const primaryBranch = process.argv[4] || '4101'; // Can override branch
const simpleSize = size.replace(/[^0-9]/g, '');
const width = simpleSize.slice(0, 3);
const aspect = simpleSize.slice(3, 5);
const rim = simpleSize.slice(5);

console.log(`Checking USAF for size: ${size} (${simpleSize})`);
if (partNumberFilter) console.log(`Filtering for part#: ${partNumberFilter}`);
console.log(`Primary branch: ${primaryBranch}`);

const body = `<request>
  <revision>1.0</revision>
  <transactionId>${Date.now()}</transactionId>
  <accountNumber>${escapeXml(account)}</accountNumber>
  <alternateFlag>no</alternateFlag>
  <branch>${primaryBranch}</branch>
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
  
  // Parse each TireDto
  const tireMatches = xml.matchAll(/<TireDto>([\s\S]*?)<\/TireDto>/g);
  
  for (const match of tireMatches) {
    const tireXml = match[1];
    const partNumber = tireXml.match(/<partNumber>([^<]+)<\/partNumber>/)?.[1];
    const brand = tireXml.match(/<brandCode>([^<]+)<\/brandCode>/)?.[1];
    const model = tireXml.match(/<model>([^<]+)<\/model>/)?.[1];
    const description = tireXml.match(/<description>([^<]+)<\/description>/)?.[1];
    
    // Filter if specified
    if (partNumberFilter && !partNumber?.includes(partNumberFilter)) continue;
    
    // Only show Toyo if no filter
    if (!partNumberFilter && !brand?.toUpperCase().includes('TOY') && !model?.toUpperCase().includes('TOYO')) continue;
    
    console.log(`\n=== ${brand} ${model} (${partNumber}) ===`);
    console.log(`Description: ${description}`);
    
    // Extract branch availability
    const branchMatches = tireXml.matchAll(/<BranchDto>([\s\S]*?)<\/BranchDto>/g);
    
    for (const branchMatch of branchMatches) {
      const branchXml = branchMatch[1];
      const code = branchXml.match(/<code>([^<]+)<\/code>/)?.[1];
      const name = branchXml.match(/<name>([^<]+)<\/name>/)?.[1];
      const city = branchXml.match(/<city>([^<]+)<\/city>/)?.[1];
      const state = branchXml.match(/<state>([^<]+)<\/state>/)?.[1];
      const qty = branchXml.match(/<quantityAvailable>([^<]+)<\/quantityAvailable>/)?.[1];
      
      if (parseInt(qty) > 0) {
        console.log(`  Branch ${code}: ${name} - ${city}, ${state} - QTY: ${qty}`);
      }
    }
  }
  
} catch (err) {
  console.error('Error:', err.message);
}
