/**
 * Find tire by TireLibrary ID in search results
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCESS_KEY = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const GROUP_TOKEN = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

const targetId = process.argv[2] || '256674';
const targetCode = process.argv[3] || '1021507';
const size = process.argv[4] || '2256517';

console.log(`Searching for ID ${targetId} or code ${targetCode} in size ${size}\n`);

const connections = [
  { provider: "tireweb_atd", connectionId: 488677 },
  { provider: "tireweb_ntw", connectionId: 488546 },
  { provider: "tireweb_usautoforce", connectionId: 488548 },
];

function extractField(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

for (const conn of connections) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${ACCESS_KEY}</prod:AccessKey>
        <prod:GroupToken>${GROUP_TOKEN}</prod:GroupToken>
        <prod:ConnectionID>${conn.connectionId}</prod:ConnectionID>
        <prod:TireSize>${size}</prod:TireSize>
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
  const tires = [...xml.matchAll(/<Tire>([\s\S]*?)<\/Tire>/g)];
  
  for (const match of tires) {
    const tire = match[1];
    const id = extractField(tire, 'ID');
    const productCode = extractField(tire, 'ProductCode');
    const clientProductCode = extractField(tire, 'ClientProductCode');
    
    if (id === targetId || productCode === targetCode || clientProductCode === targetCode) {
      console.log(`=== FOUND in ${conn.provider} ===\n`);
      const fields = [
        'ID', 'ProductCode', 'ClientProductCode', 'Make', 'Pattern', 'PatternID', 'Name',
        'UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits', 'Description',
        'SpeedRating', 'LoadRating', 'LoadRange', 'Sidewall', 'Weight',
        'ImageURL', 'BuyPrice', 'SellPrice', 'Quantity'
      ];
      
      for (const f of fields) {
        const val = extractField(tire, f);
        if (val && val !== '-1' && val !== '0') {
          console.log(`${f}: ${val.slice(0, 200)}`);
        } else if (['UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits'].includes(f)) {
          console.log(`${f}: (MISSING)`);
        }
      }
      
      console.log('\n--- RAW XML ---');
      console.log(tire);
      process.exit(0);
    }
  }
  
  console.log(`Not found in ${conn.provider} (searched ${tires.length} tires)`);
}

console.log('\nTire not found in any connection.');
