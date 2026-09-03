async function test() {
  const username = 'warehousetire';
  const password = '!-C02X!l7Kpehwx';
  const account = '1381479';
  
  // Base64 encode for HTTP Basic Auth
  const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
  
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ServiceCheck xmlns="https://services.usautoforce.com">
      <request>
        <api>
          <userName>${username}</userName>
          <password>${password}</password>
          <customerNumber>${account}</customerNumber>
        </api>
        <transactionId>${Date.now()}</transactionId>
      </request>
    </ServiceCheck>
  </soap:Body>
</soap:Envelope>`;

  console.log('Testing USAF with HTTP Basic Auth header...');
  
  const response = await fetch('https://services.usautoforce.com/integrationservice.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'https://services.usautoforce.com/ServiceCheck',
      'Authorization': `Basic ${basicAuth}`
    },
    body
  });
  
  console.log('HTTP Status:', response.status);
  const text = await response.text();
  
  if (text.includes('errorCode')) {
    // SOAP response - extract error
    const errorCode = text.match(/<errorCode>([^<]+)/)?.[1];
    const errorMsg = text.match(/<errorMessage>([^<]+)/)?.[1];
    console.log('SOAP ErrorCode:', errorCode);
    console.log('SOAP ErrorMsg:', errorMsg);
  } else {
    console.log('Response:', text.substring(0, 1500));
  }
}

test().catch(console.error);
