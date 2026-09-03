/**
 * Test the actual USAF client library to diagnose why it returns no results
 */
import 'dotenv/config';
import { XMLParser } from 'fast-xml-parser';

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

function buildSoapEnvelope(method, body, creds) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NS}">
      <User>${escapeXml(creds.username)}</User>
      <Password>${escapeXml(creds.password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <${method} xmlns="${SOAP_NS}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

const username = process.env.USAUTOFORCE_USERNAME;
const password = process.env.USAUTOFORCE_PASSWORD;
const account = process.env.USAUTOFORCE_ACCOUNT;

console.log('Credentials:', { username, account, passwordLen: password?.length });

if (!username || !password || !account) {
  console.error('Missing credentials');
  process.exit(1);
}

const size = process.argv[2] || '285/70R17';
const simpleSize = size.replace(/[^0-9]/g, '');
const width = simpleSize.slice(0, 3);
const aspect = simpleSize.slice(3, 5);
const rim = simpleSize.slice(5);

console.log(`\nTesting size: ${size} -> ${simpleSize} (w=${width} a=${aspect} r=${rim})`);

// Test 1: Without alternate branches
console.log('\n=== TEST 1: Without alternate branches ===');
const body1 = `<request>
  <revision>1.0</revision>
  <transactionId>${Date.now()}</transactionId>
  <accountNumber>${escapeXml(account)}</accountNumber>
  <alternateFlag>no</alternateFlag>
  <branch>4101</branch>
  <dataSource>manual</dataSource>
  <tires>
    <TireDto>
      <lineNumber>1</lineNumber>
      <width>${width}</width>
      <aspectRatio>${aspect}</aspectRatio>
      <rim>${rim}</rim>
      <tireSize>${simpleSize}</tireSize>
      <quantityRequested>1</quantityRequested>
    </TireDto>
  </tires>
</request>`;

const envelope1 = buildSoapEnvelope('StockCheck', body1, { username, password });

try {
  const response1 = await fetch(PROD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `${SOAP_NS}/StockCheck`,
    },
    body: envelope1,
  });
  
  const xml1 = await response1.text();
  const tireCount1 = (xml1.match(/<TireDto>/g) || []).length;
  const errorMatch1 = xml1.match(/<errorCode>([^<]*)<\/errorCode>/);
  console.log(`Status: ${response1.status}, Tires: ${tireCount1}, Error: ${errorMatch1?.[1] || 'none'}`);
} catch (err) {
  console.error('Test 1 error:', err.message);
}

// Test 2: With alternate branches (like the actual client)
console.log('\n=== TEST 2: With alternate branches ===');
const body2 = `<request>
  <revision>1.0</revision>
  <transactionId>${Date.now()}</transactionId>
  <accountNumber>${escapeXml(account)}</accountNumber>
  <alternateFlag>no</alternateFlag>
  <branch>4101</branch>
  <dataSource>manual</dataSource>
  <alternateBranches>
    <BranchDto><code>4862</code></BranchDto>
    <BranchDto><code>4501</code></BranchDto>
    <BranchDto><code>4701</code></BranchDto>
  </alternateBranches>
  <tires>
    <TireDto>
      <lineNumber>1</lineNumber>
      <width>${width}</width>
      <aspectRatio>${aspect}</aspectRatio>
      <rim>${rim}</rim>
      <tireSize>${simpleSize}</tireSize>
      <quantityRequested>1</quantityRequested>
    </TireDto>
  </tires>
</request>`;

const envelope2 = buildSoapEnvelope('StockCheck', body2, { username, password });

try {
  const response2 = await fetch(PROD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `${SOAP_NS}/StockCheck`,
    },
    body: envelope2,
  });
  
  const xml2 = await response2.text();
  const tireCount2 = (xml2.match(/<TireDto>/g) || []).length;
  const errorMatch2 = xml2.match(/<errorCode>([^<]*)<\/errorCode>/);
  console.log(`Status: ${response2.status}, Tires: ${tireCount2}, Error: ${errorMatch2?.[1] || 'none'}`);
} catch (err) {
  console.error('Test 2 error:', err.message);
}

// Test 3: With alternateBranches in same order as production
console.log('\n=== TEST 3: With alternateBranches like tire/search (includes 4101 as alternate) ===');
const body3 = `<request>
  <revision>1.0</revision>
  <transactionId>${Date.now()}</transactionId>
  <accountNumber>${escapeXml(account)}</accountNumber>
  <alternateFlag>no</alternateFlag>
  <branch>4101</branch>
  <dataSource>manual</dataSource>
  <alternateBranches>
    <BranchDto><code>4862</code></BranchDto>
    <BranchDto><code>4101</code></BranchDto>
    <BranchDto><code>4501</code></BranchDto>
    <BranchDto><code>4701</code></BranchDto>
  </alternateBranches>
  <tires>
    <TireDto>
      <lineNumber>1</lineNumber>
      <width>${width}</width>
      <aspectRatio>${aspect}</aspectRatio>
      <rim>${rim}</rim>
      <tireSize>${simpleSize}</tireSize>
      <quantityRequested>1</quantityRequested>
    </TireDto>
  </tires>
</request>`;

const envelope3 = buildSoapEnvelope('StockCheck', body3, { username, password });

try {
  const response3 = await fetch(PROD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `${SOAP_NS}/StockCheck`,
    },
    body: envelope3,
  });
  
  const xml3 = await response3.text();
  const tireCount3 = (xml3.match(/<TireDto>/g) || []).length;
  const errorMatch3 = xml3.match(/<errorCode>([^<]*)<\/errorCode>/);
  console.log(`Status: ${response3.status}, Tires: ${tireCount3}, Error: ${errorMatch3?.[1] || 'none'}`);
  
  if (tireCount3 === 0) {
    console.log('Raw response preview:', xml3.slice(0, 500));
  }
} catch (err) {
  console.error('Test 3 error:', err.message);
}
