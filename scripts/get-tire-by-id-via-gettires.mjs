/**
 * Try getting tire details via GetTires with ID parameter
 * (The WSDL shows GetTiresOptions has an ID field)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCESS_KEY = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const GROUP_TOKEN = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

const tireId = process.argv[2] || '256674';
const connectionId = process.argv[3] || '488677';

console.log(`Getting tire details for ID ${tireId}\n`);

// Try GetTires with ID parameter
const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:ID>${tireId}</prod:ID>
        <prod:AccessKey>${ACCESS_KEY}</prod:AccessKey>
        <prod:GroupToken>${GROUP_TOKEN}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
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

function extractField(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

const errCode = extractField(xml, 'ErrorCode');
const errMsg = extractField(xml, 'ErrorMessage');
if (errCode && errCode !== '0') {
  console.log(`Error ${errCode}: ${errMsg}`);
  console.log('\nRaw:', xml.slice(0, 1000));
  process.exit(1);
}

const tireMatch = xml.match(/<Tire>([\s\S]*?)<\/Tire>/);
if (!tireMatch) {
  console.log('No tire in response');
  console.log(xml.slice(0, 2000));
  process.exit(1);
}

const tire = tireMatch[1];
console.log('=== TIRE DETAILS (via GetTires + ID) ===\n');

const fields = [
  'ID', 'ProductCode', 'Make', 'Pattern', 'PatternID', 'Name',
  'UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits', 'Description',
  'SpeedRating', 'LoadRating', 'LoadRange', 'Sidewall', 'Weight',
  'SectionWidth', 'MeasuredOD', 'ApprovedRimWidth',
  'ImageURL', 'BuyPrice', 'SellPrice', 'Quantity'
];

for (const f of fields) {
  const val = extractField(tire, f);
  if (val && val !== '-1' && val !== '0' && val.trim()) {
    console.log(`${f}: ${val.slice(0, 200)}`);
  } else if (['UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits', 'MeasuredOD'].includes(f)) {
    console.log(`${f}: (MISSING)`);
  }
}
