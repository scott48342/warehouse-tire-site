/**
 * Test USAF direct API for specific tire
 */

// Load env vars
import { config } from 'dotenv';
config({ path: '.env.local' });

// Try test endpoint since prod is returning 401
const USAF_API_URL = 'https://servicesstage.usautoforce.com/integrationservice.asmx';
const SOAP_NAMESPACE = 'https://services.usautoforce.com';

// Build SOAP envelope for StockCheck
function buildStockCheckRequest(tireSize, branch = '4101') {
  const username = process.env.USAUTOFORCE_USERNAME;
  const password = process.env.USAUTOFORCE_PASSWORD;
  const account = process.env.USAUTOFORCE_ACCOUNT;
  
  console.log('Credentials:', { username, account, hasPassword: !!password });
  
  // Normalize size: "295/55R22" -> "2955522"
  const simpleSize = tireSize.replace(/[^0-9]/g, '');
  
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <StockCheck xmlns="${SOAP_NAMESPACE}">
      <request>
        <username>${username}</username>
        <password>${password}</password>
        <accountNumber>${account}</accountNumber>
        <branchId>${branch}</branchId>
        <tireSize>${simpleSize}</tireSize>
        <quantity>4</quantity>
      </request>
    </StockCheck>
  </soap:Body>
</soap:Envelope>`;
}

async function testUSAF() {
  const size = '295/55R22'; // Toyo RT Pro size
  console.log(`Testing USAF StockCheck for size: ${size}\n`);
  
  const envelope = buildStockCheckRequest(size);
  
  try {
    const response = await fetch(USAF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `${SOAP_NAMESPACE}/StockCheck`,
      },
      body: envelope,
    });
    
    const xml = await response.text();
    console.log('Response status:', response.status);
    console.log('Response length:', xml.length);
    
    if (response.status === 401) {
      console.log('\n=== 401 RESPONSE ===');
      console.log(xml);
      return;
    }
    
    // Check for errors
    const errorMatch = xml.match(/<errorCode>(\d+)<\/errorCode>/);
    const errorMsgMatch = xml.match(/<errorMessage>([^<]*)<\/errorMessage>/);
    
    if (errorMatch && errorMatch[1] !== '0') {
      console.log('ERROR:', errorMatch[1], errorMsgMatch?.[1]);
      return;
    }
    
    // Extract tire results
    const tireMatches = xml.matchAll(/<TireDto>([\s\S]*?)<\/TireDto>/g);
    const tires = [];
    
    for (const match of tireMatches) {
      const tireXml = match[1];
      const extract = (tag) => {
        const m = tireXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return m ? m[1] : null;
      };
      
      tires.push({
        partNumber: extract('partNumber'),
        brand: extract('brandCode'),
        model: extract('model'),
        description: extract('description'),
        cost: parseFloat(extract('cost')) || 0,
        map: parseFloat(extract('map')) || null,
        fet: parseFloat(extract('fet')) || null,
        utqg: extract('utqg'),
        treadDepth: extract('treadDepth'),
        warranty: extract('mileageWarranty'),
      });
    }
    
    console.log(`\nFound ${tires.length} tires:\n`);
    
    // Find Toyo
    const toyoTires = tires.filter(t => t.brand === 'TOY' || t.model?.toLowerCase().includes('toyo'));
    
    if (toyoTires.length > 0) {
      console.log('=== TOYO TIRES ===');
      for (const t of toyoTires) {
        console.log(`  ${t.partNumber}: ${t.model}`);
        console.log(`    Cost: $${t.cost}, MAP: $${t.map}, FET: $${t.fet}`);
        console.log(`    UTQG: ${t.utqg}, Tread: ${t.treadDepth}, Warranty: ${t.warranty}`);
        console.log();
      }
    } else {
      console.log('No Toyo tires found in results');
      console.log('\nAll brands found:', [...new Set(tires.map(t => t.brand))].join(', '));
    }
    
    // Show first few for reference
    console.log('\n=== SAMPLE RESULTS ===');
    for (const t of tires.slice(0, 5)) {
      console.log(`${t.partNumber}: ${t.brand} ${t.model} - $${t.cost}`);
    }
    
  } catch (err) {
    console.error('Request failed:', err);
  }
}

testUSAF();
