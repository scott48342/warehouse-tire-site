const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const filePath = path.join(__dirname, '../src/techfeed/wheels_by_sku.json.gz');

const buf = fs.readFileSync(filePath);
const json = zlib.gunzipSync(buf).toString('utf8');
const data = JSON.parse(json);

const allWheels = Object.values(data.bySku);

// Check Petrol wheels with 5x115 bolt pattern
const petrol5x115 = allWheels.filter(w => {
  const isPetrol = (w.brand_cd === 'PET' || w.brand_cd === 'PE') || 
                   (w.brand_desc || '').toLowerCase().includes('petrol');
  const bp = (w.bolt_pattern_metric || w.bolt_pattern_standard || '').toUpperCase();
  const is5x115 = bp.includes('5X115');
  return isPetrol && is5x115;
});

console.log('Petrol 5x115 in techfeed:', petrol5x115.length);
console.log('\nSample (sorted by price):');
petrol5x115
  .sort((a, b) => parseFloat(a.msrp || '999999') - parseFloat(b.msrp || '999999'))
  .slice(0, 15)
  .forEach(w => {
    const dia = w.diameter || '?';
    console.log(`  ${w.sku}: ${w.style || w.display_style_no} ${dia}x${w.width} ${w.bolt_pattern_metric} - $${w.msrp} (offset: ${w.offset})`);
  });

// Check Petrol 5x115 with 18" or 19" diameter
console.log('\n--- 18" and 19" only ---');
const petrol5x115_18_19 = petrol5x115.filter(w => {
  const dia = parseFloat(w.diameter || '0');
  return dia === 18 || dia === 19;
});
console.log('Count:', petrol5x115_18_19.length);
petrol5x115_18_19
  .sort((a, b) => parseFloat(a.msrp || '999999') - parseFloat(b.msrp || '999999'))
  .slice(0, 10)
  .forEach(w => {
    console.log(`  ${w.sku}: ${w.style} ${w.diameter}x${w.width} - $${w.msrp} (offset: ${w.offset})`);
  });
