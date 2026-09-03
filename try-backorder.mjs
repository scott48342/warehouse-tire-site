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

// Try different fillFlag values
const fillFlags = ['backord', 'partial', 'complete', 'all'];

for (const fillFlag of fillFlags) {
  console.log(`\n=== Trying fillFlag: "${fillFlag}" ===`);
  
  const transactionId = Date.now().toString();
  
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(accountNumber)}</accountNumber>
    <fillFlag>${fillFlag}</fillFlag>
    <branch>4101</branch>
    <poNumber>TEST-BACKORDER-${fillFlag}</poNumber>
    <deliveryMethod>FedEx-Grou</deliveryMethod>
    <shipTo>
      <shipToCode>99999</shipToCode>
      <customerName>Test Customer</customerName>
      <address1>123 Test St</address1>
      <city>North Port</city>
      <state>FL</state>
      <zip>34291</zip>
    </shipTo>
    <billTo>
      <billToCode>${escapeXml(accountNumber)}</billToCode>
    </billTo>
    <parts>
      <PartDto>
        <lineNumber>1</lineNumber>
        <lineCode>HAN</lineCode>
        <partNumber>1038485</partNumber>
        <quantityRequested>4</quantityRequested>
      </PartDto>
    </parts>
  </request>`;

  const envelope = buildSoapEnvelope("Order", body, creds);

  const response = await fetch("https://services.usautoforce.com/integrationservice.asmx", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `${SOAP_NAMESPACE}/Order`,
    },
    body: envelope,
  });

  const text = await response.text();
  
  const errorCode = text.match(/<errorCode>([^<]+)<\/errorCode>/)?.[1];
  const errorMessage = text.match(/<errorMessage>([^<]+)<\/errorMessage>/)?.[1];
  const orderNumber = text.match(/<orderNumber>([^<]+)<\/orderNumber>/)?.[1];
  
  console.log('errorCode:', errorCode);
  console.log('errorMessage:', errorMessage);
  console.log('orderNumber:', orderNumber || 'none');
  
  // Don't actually place orders - just testing
  if (orderNumber) {
    console.log('*** Would have placed order! Stopping test. ***');
    break;
  }
  
  // Small delay between requests
  await new Promise(r => setTimeout(r, 500));
}
