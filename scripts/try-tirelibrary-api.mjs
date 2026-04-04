/**
 * Try TireLibrary direct API
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCESS_KEY = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const GROUP_TOKEN = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

const tireId = process.argv[2] || '256674';

console.log(`Trying TireLibrary API for tire ${tireId}\n`);

const tokens = [
  { name: 'AccessKey', token: ACCESS_KEY },
  { name: 'GroupToken', token: GROUP_TOKEN },
];

for (const { name, token } of tokens) {
  if (!token) continue;
  
  console.log(`--- Trying: ${name} ---`);
  
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTireByID xmlns="http://www.tirewire.com/tire-library-ws/tirelibraryws">
      <token>${token}</token>
      <tireID>${tireId}</tireID>
    </GetTireByID>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch('http://matt.tirewire.com/tire-library-ws/tirelibrarywebservice.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': 'http://www.tirewire.com/tire-library-ws/tirelibraryws/GetTireByID',
    },
    body,
  });

  const xml = await res.text();
  
  const errCode = xml.match(/<ErrorCode>(\d+)<\/ErrorCode>/);
  const errMsg = xml.match(/<ErrorMessage>([^<]*)<\/ErrorMessage>/);
  
  if (errCode && errCode[1] !== '0') {
    console.log(`Error ${errCode[1]}: ${errMsg ? errMsg[1] : 'unknown'}\n`);
    continue;
  }
  
  const tireMatch = xml.match(/<Tire>([\s\S]*?)<\/Tire>/);
  if (tireMatch) {
    console.log('SUCCESS! Got tire data:\n');
    
    const tire = tireMatch[1];
    const extractField = (t, f) => {
      const m = t.match(new RegExp(`<${f}>([\\s\\S]*?)</${f}>`));
      return m ? m[1].trim() : null;
    };
    
    const fields = ['ID', 'Make', 'Pattern', 'Name', 'UTQG', 'Warranty', 'TreadDepth', 'MeasuredOD', 'Features', 'Description'];
    for (const f of fields) {
      const val = extractField(tire, f);
      console.log(`${f}: ${val || '(empty)'}`);
    }
    
    console.log('\n--- Full Response ---');
    console.log(xml.slice(0, 3000));
    break;
  } else {
    console.log('No tire in response');
    console.log(xml.slice(0, 500));
    console.log('\n');
  }
}
