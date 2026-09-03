/**
 * Get raw USAF response to see full branch data
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';

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

const size = '285/70R17';
const simpleSize = '2857017';

console.log(`Querying for Toyo 358060 with alternateFlag=yes...`);

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
      <width>285</width>
      <aspectRatio>70</aspectRatio>
      <rim>17</rim>
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
  
  // Save full response
  writeFileSync('usaf-response.xml', xml);
  console.log('Full response saved to usaf-response.xml');
  
  // Find 358060 and show its full XML
  const match = xml.match(/<TireDto>[\s\S]*?<partNumber>358060<\/partNumber>[\s\S]*?<\/TireDto>/);
  if (match) {
    console.log('\n=== TOYO 358060 FULL DATA ===\n');
    console.log(match[0]);
  } else {
    console.log('358060 not found in response');
  }
  
} catch (err) {
  console.error('Error:', err.message);
}
