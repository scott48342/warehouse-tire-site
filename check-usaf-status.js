const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('.env.local', 'utf8');

function getEnv(name) {
  const match = envContent.match(new RegExp(`${name}=["']?([^"'\\r\\n]+)`));
  return match ? match[1] : null;
}

const username = getEnv('USAUTOFORCE_USERNAME');
const password = getEnv('USAUTOFORCE_PASSWORD');
const account = getEnv('USAUTOFORCE_ACCOUNT');

console.log('Using account:', account);

const orderNumber = 'HDS26692934';

const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <GetOrderDetails xmlns="https://services.usautoforce.com/">
      <requestHeader>
        <userName>${username}</userName>
        <password>${password}</password>
        <aISGatewayId>eTailer</aISGatewayId>
        <version>1.0</version>
        <userAccount>${account}</userAccount>
      </requestHeader>
      <salesOrderNumber>${orderNumber}</salesOrderNumber>
    </GetOrderDetails>
  </soap:Body>
</soap:Envelope>`;

const options = {
  hostname: 'services.usautoforce.com',
  port: 443,
  path: '/ais.asmx',
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': 'https://services.usautoforce.com/GetOrderDetails'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', async () => {
    // Extract tracking info with regex
    const trackingMatch = data.match(/<trackingNumber>([^<]+)<\/trackingNumber>/gi);
    const statusMatch = data.match(/<orderStatus>([^<]+)<\/orderStatus>/i);
    const shipDateMatch = data.match(/<shipDate>([^<]+)<\/shipDate>/i);
    const carrierMatch = data.match(/<carrier>([^<]+)<\/carrier>/i);
    
    console.log('Order:', orderNumber);
    console.log('Status:', statusMatch ? statusMatch[1] : 'Not found');
    console.log('Ship Date:', shipDateMatch ? shipDateMatch[1] : 'Not found');
    console.log('Carrier:', carrierMatch ? carrierMatch[1] : 'Not found');
    console.log('Tracking:', trackingMatch ? trackingMatch.map(t => t.replace(/<[^>]+>/g, '')) : 'None');
    
    if (!statusMatch) {
      console.log('\nRaw response (first 2000 chars):', data.substring(0, 2000));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e));
req.write(xml);
req.end();
