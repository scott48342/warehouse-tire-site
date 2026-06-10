import fs from 'fs';
import zlib from 'zlib';

const data = JSON.parse(zlib.gunzipSync(fs.readFileSync('src/techfeed/wheels_by_sku.json.gz')).toString());

// Find 14" wheels with 5x114.3
const wheels = Object.values(data.bySku).filter(w => {
  const bp = (w.bolt_pattern_metric || '').toLowerCase().replace(/\s/g, '');
  return bp === '5x114.3' && parseInt(w.diameter) === 14;
});

console.log(`Found ${wheels.length} wheels with 5x114.3 and 14" diameter:\n`);

wheels.forEach(w => {
  console.log(`SKU: ${w.sku}`);
  console.log(`  Brand: ${w.brand_desc || w.brand_cd}`);
  console.log(`  Style: ${w.style || w.display_style_no}`);
  console.log(`  Size: ${w.diameter}x${w.width}`);
  console.log(`  Offset: ${w.offset}`);
  console.log(`  MAP: ${w.map_price}`);
  console.log(`  MSRP: ${w.msrp}`);
  console.log('');
});
