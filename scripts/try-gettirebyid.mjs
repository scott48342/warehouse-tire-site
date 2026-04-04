/**
 * Try GetTireByID with various key formats
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCESS_KEY = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const GROUP_TOKEN = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

const tireId = process.argv[2] || '256674';

console.log(`Trying GetTireByID for tire ${tireId}\n`);

// Keys to try
const keysToTry = [
  { name: 'AccessKey', key: ACCESS_KEY },
  { name: 'GroupToken', key: GROUP_TOKEN },
  { name: 'Combined', key: `${ACCESS_KEY}:${GROUP_TOKEN}` },
  { name: 'AccessKey trimmed', key: ACCESS_KEY?.trim() },
];

for (const { name, key } of keysToTry) {
  if (!key) continue;
  
  console.log(`--- Trying: ${name} ---`);
  
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTireByID>
      <prod:key>${key}</prod:key>
      <prod:id>${tireId}</prod:id>
      <prod:getFullDetails>true</prod:getFullDetails>
    </prod:GetTireByID>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch('http://ws.tirewire.com/connectionscenter/productsservice.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': 'http://ws.tirewire.com/connectionscenter/productsservice/GetTireByID',
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
  
  // Check for tire data
  const tireMatch = xml.match(/<Tire>([\s\S]*?)<\/Tire>/);
  if (tireMatch) {
    console.log('SUCCESS! Got tire data:\n');
    
    const tire = tireMatch[1];
    const extractField = (t, f) => {
      const m = t.match(new RegExp(`<${f}>([\\s\\S]*?)</${f}>`));
      return m ? m[1].trim() : null;
    };
    
    const fields = ['ID', 'Make', 'Pattern', 'UTQG', 'Warranty', 'TreadDepth', 'Features'];
    for (const f of fields) {
      console.log(`${f}: ${extractField(tire, f) || '(empty)'}`);
    }
    break;
  } else {
    console.log('No tire in response\n');
  }
}
