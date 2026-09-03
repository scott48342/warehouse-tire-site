/**
 * Test USAF Production API with exact credentials from Jennifer's email
 */

const PROD_URL = 'https://services.usautoforce.com/integrationservice.asmx';
const SOAP_NS = 'https://services.usautoforce.com';

// Credentials from email
const USERNAME = 'warehousetire';
const PASSWORD = '!-C02X!l7Kpehwx';
const ACCOUNT = '1381479';

async function testStockCheck(tireSize, branch = '4101') {
  // Normalize size: "285/70R17" -> "2857017"
  const simpleSize = tireSize.replace(/[^0-9]/g, '');
  
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <StockCheck xmlns="${SOAP_NS}">
      <request>
        <username>${USERNAME}</username>
        <password>${PASSWORD}</password>
        <accountNumber>${ACCOUNT}</accountNumber>
        <branchId>${branch}</branchId>
        <tireSize>${simpleSize}</tireSize>
        <quantity>4</quantity>
      </request>
    </StockCheck>
  </soap:Body>
</soap:Envelope>`;

  console.log(`\n=== Testing StockCheck for ${tireSize} (${simpleSize}) ===`);
  console.log(`URL: ${PROD_URL}`);
  console.log(`Account: ${ACCOUNT}, User: ${USERNAME}, Branch: ${branch}`);
  
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
    console.log(`Status: ${response.status}`);
    console.log(`Response length: ${xml.length}`);
    
    if (response.status !== 200) {
      console.log('\n--- ERROR RESPONSE ---');
      console.log(xml.substring(0, 500));
      return null;
    }
    
    // Check for SOAP error
    const errorMatch = xml.match(/<errorCode>(\d+)<\/errorCode>/);
    const errorMsgMatch = xml.match(/<errorMessage>([^<]*)<\/errorMessage>/);
    
    if (errorMatch && errorMatch[1] !== '0') {
      console.log(`\nAPI Error: ${errorMatch[1]} - ${errorMsgMatch?.[1]}`);
      return null;
    }
    
    // Count tires
    const tireMatches = [...xml.matchAll(/<TireDto>/g)];
    console.log(`\nFound ${tireMatches.length} tires`);
    
    // Extract specific tire info
    const tires = [];
    const tireDtos = xml.matchAll(/<TireDto>([\s\S]*?)<\/TireDto>/g);
    
    for (const match of tireDtos) {
      const t = match[1];
      const extract = (tag) => {
        const m = t.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return m ? m[1] : null;
      };
      
      tires.push({
        partNumber: extract('partNumber'),
        brand: extract('brandCode'),
        model: extract('model'),
        cost: parseFloat(extract('cost')) || 0,
        map: parseFloat(extract('map')) || null,
      });
    }
    
    return tires;
    
  } catch (err) {
    console.error('Request failed:', err.message);
    return null;
  }
}

async function testServiceCheck() {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ServiceCheck xmlns="${SOAP_NS}">
      <request>
        <username>${USERNAME}</username>
        <password>${PASSWORD}</password>
        <accountNumber>${ACCOUNT}</accountNumber>
      </request>
    </ServiceCheck>
  </soap:Body>
</soap:Envelope>`;

  console.log('=== Testing ServiceCheck (auth test) ===');
  console.log(`URL: ${PROD_URL}`);
  
  try {
    const response = await fetch(PROD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `${SOAP_NS}/ServiceCheck`,
      },
      body: envelope,
    });
    
    const xml = await response.text();
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200) {
      const errorMatch = xml.match(/<errorCode>(\d+)<\/errorCode>/);
      const errorMsgMatch = xml.match(/<errorMessage>([^<]*)<\/errorMessage>/);
      console.log(`Error code: ${errorMatch?.[1] || 'none'}`);
      console.log(`Error msg: ${errorMsgMatch?.[1] || 'none'}`);
      
      if (!errorMatch || errorMatch[1] === '0') {
        console.log('✅ ServiceCheck PASSED - credentials valid!');
        return true;
      }
    } else {
      console.log('Response:', xml.substring(0, 300));
    }
    return false;
    
  } catch (err) {
    console.error('Request failed:', err.message);
    return false;
  }
}

async function main() {
  // First test auth
  const authOk = await testServiceCheck();
  
  if (!authOk) {
    console.log('\n❌ Auth failed - cannot proceed with stock check');
    return;
  }
  
  // Test stock check for 285/70R17 (the Toyo RT Pro size)
  const tires = await testStockCheck('285/70R17');
  
  if (tires && tires.length > 0) {
    // Look for Toyo
    const toyoTires = tires.filter(t => 
      t.brand === 'TOY' || 
      t.model?.toLowerCase().includes('toyo') ||
      t.partNumber === '358060' ||
      t.partNumber === '355530'
    );
    
    console.log(`\n=== TOYO TIRES (${toyoTires.length}) ===`);
    for (const t of toyoTires) {
      console.log(`${t.partNumber}: ${t.brand} ${t.model} - Cost: $${t.cost}, MAP: $${t.map}`);
    }
    
    // Show all brands found
    const brands = [...new Set(tires.map(t => t.brand))].filter(Boolean);
    console.log(`\nAll brands: ${brands.join(', ')}`);
    
    // Show first 10 results
    console.log('\n=== FIRST 10 RESULTS ===');
    for (const t of tires.slice(0, 10)) {
      console.log(`${t.partNumber}: ${t.brand} ${t.model} - $${t.cost}`);
    }
  }
}

main();
