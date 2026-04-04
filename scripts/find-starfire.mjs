/**
 * Find Starfire Solarus in TireWeb
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCESS_KEY = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const GROUP_TOKEN = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${ACCESS_KEY}</prod:AccessKey>
        <prod:GroupToken>${GROUP_TOKEN}</prod:GroupToken>
        <prod:ConnectionID>488548</prod:ConnectionID>
        <prod:TireSize>2256517</prod:TireSize>
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

// Find Starfire tires
const tires = xml.matchAll(/<Tire>([\s\S]*?)<\/Tire>/g);

function extractField(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

console.log('=== STARFIRE TIRES IN US AUTOFORCE ===\n');

let count = 0;
for (const match of tires) {
  const tire = match[1];
  const make = extractField(tire, 'Make');
  
  if (make === 'STARFIRE') {
    count++;
    console.log('---');
    console.log('ID:', extractField(tire, 'ID'));
    console.log('ProductCode:', extractField(tire, 'ProductCode'));
    console.log('ClientProductCode:', extractField(tire, 'ClientProductCode'));
    console.log('Make:', make);
    console.log('Pattern:', extractField(tire, 'Pattern'));
    console.log('PatternID:', extractField(tire, 'PatternID'));
    console.log('Name:', extractField(tire, 'Name'));
    console.log('UTQG:', extractField(tire, 'UTQG') || '(MISSING)');
    console.log('Warranty:', extractField(tire, 'Warranty') || '(MISSING)');
    console.log('TreadDepth:', extractField(tire, 'TreadDepth') || '(MISSING)');
    console.log('Features:', extractField(tire, 'Features') || '(MISSING)');
    console.log('ImageURL:', extractField(tire, 'ImageURL'));
    console.log('BuyPrice:', extractField(tire, 'BuyPrice'));
    console.log('Quantity:', extractField(tire, 'Quantity'));
    console.log();
  }
}

console.log(`Total Starfire tires found: ${count}`);
