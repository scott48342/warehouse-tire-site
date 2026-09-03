async function test() {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ServiceCheck xmlns="https://services.usautoforce.com">
      <request>
        <api>
          <userName>warehousetire</userName>
          <password>!-C02X!l7Kpehwx</password>
          <customerNumber>1381479</customerNumber>
        </api>
        <transactionId>${Date.now()}</transactionId>
      </request>
    </ServiceCheck>
  </soap:Body>
</soap:Envelope>`;

  console.log('Testing USAF ServiceCheck with PRODUCTION creds...');
  console.log('URL: https://services.usautoforce.com/integrationservice.asmx');
  console.log('User: warehousetire');
  console.log('Account: 1381479\n');
  
  const response = await fetch('https://services.usautoforce.com/integrationservice.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'https://services.usautoforce.com/ServiceCheck'
    },
    body
  });
  
  console.log('HTTP Status:', response.status);
  const text = await response.text();
  console.log('Response:', text.substring(0, 2000));
}

test().catch(console.error);
