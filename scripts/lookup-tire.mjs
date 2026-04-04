/**
 * Look up a specific tire by part number
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCESS_KEY = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const GROUP_TOKEN = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

const partNumber = process.argv[2] || '162199001';
const connectionId = process.argv[3] || '488677';

console.log(`Looking up part: ${partNumber} on connection ${connectionId}\n`);

const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${ACCESS_KEY}</prod:AccessKey>
        <prod:GroupToken>${GROUP_TOKEN}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:ClientProductCode>${partNumber}</prod:ClientProductCode>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

const res = await fetch('http://ws.tirewire.com/connectionscenter/productsservice.asmx', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml;charset=UTF-8',
    'SOAPAction': 'http://ws.tirewire.com/connectionscenter/productsservice/GetTires',
  },
  body,
});

const xml = await res.text();

// Extract tire XML
const m = xml.match(/<Tire>([\s\S]*?)<\/Tire>/);
if (m) {
  const tire = m[1];
  const fields = [
    'ID', 'ProductCode', 'ClientProductCode', 'Make', 'Pattern', 'PatternID', 'Name',
    'Width', 'AspectRatio', 'Rim',
    'UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits', 'Description',
    'SpeedRating', 'LoadRating', 'LoadRange', 'Sidewall',
    'ImageURL', 'BuyPrice', 'SellPrice', 'Quantity', 'QuantitySecondary'
  ];
  
  console.log('=== TIRE DETAILS ===\n');
  for (const f of fields) {
    const fm = tire.match(new RegExp('<' + f + '>([\\s\\S]*?)</' + f + '>'));
    const val = fm ? fm[1].trim() : '(empty)';
    if (val && val !== '(empty)' && val !== '-1' && val !== '0') {
      console.log(`${f}: ${val.slice(0, 150)}`);
    } else if (['UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits'].includes(f)) {
      console.log(`${f}: (MISSING)`);
    }
  }
  
  console.log('\n=== RAW TIRE XML ===\n');
  console.log(tire);
} else {
  const errCode = xml.match(/<ErrorCode>(\d+)<\/ErrorCode>/);
  const errMsg = xml.match(/<ErrorMessage>([^<]+)<\/ErrorMessage>/);
  if (errCode) {
    console.log(`Error ${errCode[1]}: ${errMsg ? errMsg[1] : 'unknown'}`);
  } else {
    console.log('No tire found. Response:', xml.slice(0, 1000));
  }
}
