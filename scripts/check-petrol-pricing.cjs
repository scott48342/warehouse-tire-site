const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const filePath = path.join(__dirname, '../src/techfeed/wheels_by_sku.json.gz');

const buf = fs.readFileSync(filePath);
const json = zlib.gunzipSync(buf).toString('utf8');
const data = JSON.parse(json);

const allWheels = Object.values(data.bySku);

// Get Petrol 5x115 18/19" wheels
const petrol5x115 = allWheels.filter(w => {
  const isPetrol = w.brand_cd === 'PE';
  const bp = (w.bolt_pattern_metric || w.bolt_pattern_standard || '').toUpperCase();
  const is5x115 = bp.includes('5X115');
  const dia = parseFloat(w.diameter || '0');
  const is18or19 = dia === 18 || dia === 19;
  return isPetrol && is5x115 && is18or19;
});

console.log('Petrol 5x115 18/19" wheels:', petrol5x115.length);
console.log('\nPricing data:');
petrol5x115.slice(0, 15).forEach(w => {
  console.log(`  ${w.sku}: msrp=${w.msrp} map_price=${w.map_price}`);
});

// Check getSafeWheelPrice logic
// From route.ts: Only trust MSRP if MAP is also present
console.log('\n--- Checking getSafeWheelPrice logic ---');
petrol5x115.slice(0, 15).forEach(w => {
  const mapValue = Number(w.map_price) || null;
  const msrpValue = Number(w.msrp) || null;
  
  // DATA QUALITY FIX: Only trust MSRP if MAP is also present
  let finalPrice = 0;
  if (mapValue && mapValue > 0) {
    finalPrice = mapValue;
  } else if (msrpValue && msrpValue > 0 && mapValue) {
    finalPrice = msrpValue;
  } else {
    finalPrice = 0; // Reject - unreliable price
  }
  
  console.log(`  ${w.sku}: map=${mapValue}, msrp=${msrpValue} => finalPrice=${finalPrice} ${finalPrice > 0 ? '✓' : '❌ FILTERED'}`);
});
