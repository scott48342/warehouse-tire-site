const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const filePath = path.join(__dirname, '../src/techfeed/wheels_by_sku.json.gz');

const buf = fs.readFileSync(filePath);
const json = zlib.gunzipSync(buf).toString('utf8');
const data = JSON.parse(json);

const allWheels = Object.values(data.bySku);

// Get Petrol wheels and check their brand_cd
const petrol = allWheels.filter(w => 
  (w.brand_desc || '').toLowerCase().includes('petrol')
);

console.log('Petrol wheels:', petrol.length);
console.log('Sample Petrol brand codes:');
petrol.slice(0, 10).forEach(w => {
  console.log(`  ${w.sku}: brand_cd="${w.brand_cd}" brand_desc="${w.brand_desc}"`);
});

// Get ALL unique brand codes
const brandCodes = [...new Set(allWheels.map(w => w.brand_cd))].sort();
console.log('\nAll brand codes in techfeed:');
brandCodes.forEach(bc => {
  const count = allWheels.filter(w => w.brand_cd === bc).length;
  const desc = allWheels.find(w => w.brand_cd === bc)?.brand_desc || '?';
  console.log(`  ${bc}: ${desc} (${count} wheels)`);
});
