// Test USAF OrderStatusDetail API for tracking numbers
require('dotenv').config({ path: '.env.local' });

const SOAP_NAMESPACE = "https://services.usautoforce.com";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSoapEnvelope(method, body) {
  const username = process.env.USAUTOFORCE_USERNAME;
  const password = process.env.USAUTOFORCE_PASSWORD;
  
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NAMESPACE}">
      <User>${escapeXml(username)}</User>
      <Password>${escapeXml(password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <${method} xmlns="${SOAP_NAMESPACE}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

async function getOrderStatus(orderNumber) {
  const account = process.env.USAUTOFORCE_ACCOUNT;
  const isTest = process.env.USAUTOFORCE_USERNAME?.toLowerCase().includes('test');
  const apiUrl = isTest 
    ? "https://servicesstage.usautoforce.com/integrationservice.asmx"
    : "https://services.usautoforce.com/integrationservice.asmx";
  
  console.log(`Using ${isTest ? 'TEST' : 'PRODUCTION'} API: ${apiUrl}`);
  console.log(`Account: ${account}`);
  
  const transactionId = Date.now().toString();
  
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(account)}</accountNumber>
    <orderNumber>${escapeXml(orderNumber)}</orderNumber>
    <orderType>invoiced</orderType>
  </request>`;
  
  const envelope = buildSoapEnvelope("OrderStatusDetail", body);
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `${SOAP_NAMESPACE}/OrderStatusDetail`,
    },
    body: envelope,
  });
  
  const xml = await response.text();
  console.log('\n=== RAW RESPONSE ===');
  console.log(xml);
  
  // Extract tracking numbers - look for tracking patterns
  const trackingMatches = xml.matchAll(/<trackingNumber[^>]*>([^<]+)<\/trackingNumber>/gi);
  const trackings1 = Array.from(trackingMatches, m => m[1]);
  
  // Also check for string arrays (what the current code does)
  const stringMatches = xml.matchAll(/<string>(\d{10,})<\/string>/g);
  const trackings2 = Array.from(stringMatches, m => m[1]);
  
  console.log('\n=== TRACKING NUMBERS ===');
  console.log('From <trackingNumber>:', trackings1);
  console.log('From <string> (numeric):', trackings2);
}

// Laura's USAF order number
getOrderStatus('HDS26692934').catch(console.error);
