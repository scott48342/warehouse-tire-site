import 'dotenv/config';

// USAF credentials from env
const USAF_USER = process.env.USAUTOFORCE_USERNAME;
const USAF_PASS = process.env.USAUTOFORCE_PASSWORD;
const USAF_CUST = process.env.USAUTOFORCE_ACCOUNT;
// Username has 'test' so use staging URL
const USAF_URL = 'https://servicesstage.usautoforce.com/integrationservice.asmx';

async function checkStock(tireSize, branch = '4101') {
  // Parse tire size like 285/70R17 -> 2857017
  const match = tireSize.match(/(\d+)\/(\d+)R?(\d+)/i);
  if (!match) throw new Error('Invalid tire size');
  const simpleSize = match[1] + match[2] + match[3];
  
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <StockCheck xmlns="https://services.usautoforce.com">
      <request>
        <api>
          <userName>${USAF_USER}</userName>
          <password>${USAF_PASS}</password>
          <customerNumber>${USAF_CUST}</customerNumber>
        </api>
        <transactionId>${Date.now()}</transactionId>
        <alternateFlag>yes</alternateFlag>
        <branch>${branch}</branch>
        <dataSource>manual</dataSource>
        <quantity>4</quantity>
        <tireSize>${simpleSize}</tireSize>
        <typeOfTire>LT</typeOfTire>
        <wheelSize>${match[3]}</wheelSize>
      </request>
    </StockCheck>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(USAF_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'https://services.usautoforce.com/StockCheck'
    },
    body
  });
  
  return res.text();
}

async function main() {
  console.log('Checking USAF stock for Toyo 358060 (285/70R17)...\n');
  
  const xml = await checkStock('285/70R17', '4101');
  
  // Debug: print first 2000 chars
  console.log('Response preview:', xml.substring(0, 2000));
  
  // Debug: check for errors
  const errorCode = xml.match(/<errorCode>([^<]+)/)?.[1];
  const errorMsg = xml.match(/<errorMessage>([^<]+)/)?.[1];
  console.log('ErrorCode:', errorCode, 'ErrorMsg:', errorMsg);
  if (errorCode && errorCode !== '0') {
    return;
  }
  
  // Find all Toyo results
  const toyoMatches = xml.matchAll(/<TireDto>([\s\S]*?)<\/TireDto>/g);
  
  for (const match of toyoMatches) {
    const tire = match[1];
    const partNum = tire.match(/<partNumber>([^<]+)/)?.[1];
    const brand = tire.match(/<brand>([^<]+)/)?.[1];
    const desc = tire.match(/<description>([^<]+)/)?.[1];
    
    // Only show Toyo 358060
    if (partNum !== '358060') continue;
    
    console.log(`Part#: ${partNum}`);
    console.log(`Brand: ${brand}`);
    console.log(`Desc: ${desc}`);
    
    // Get warehouse availability
    const branches = tire.matchAll(/<BranchDto>([\s\S]*?)<\/BranchDto>/g);
    console.log('\nWarehouse Availability:');
    
    for (const b of branches) {
      const branchXml = b[1];
      const code = branchXml.match(/<code>([^<]+)/)?.[1];
      const name = branchXml.match(/<name>([^<]+)/)?.[1];
      const city = branchXml.match(/<city>([^<]+)/)?.[1];
      const state = branchXml.match(/<state>([^<]+)/)?.[1];
      const qty = branchXml.match(/<quantityAvailable>([^<]+)/)?.[1];
      const transfer = branchXml.match(/<transferRequired>([^<]+)/)?.[1];
      
      if (parseInt(qty) > 0) {
        console.log(`  ${code} - ${name}, ${city}, ${state}: ${qty} in stock ${transfer === 'true' ? '(transfer)' : ''}`);
      }
    }
    console.log('');
  }
}

main().catch(console.error);
