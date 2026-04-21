import fs from 'node:fs';
import zlib from 'node:zlib';

const buf = fs.readFileSync('src/techfeed/wheels_by_sku.json.gz');
const json = zlib.gunzipSync(buf).toString('utf8');
const data = JSON.parse(json);

const matches = [];
for (const [sku, wheel] of Object.entries(data.bySku)) {
  const style = wheel.style || '';
  const desc = wheel.product_desc || '';
  if (style.toLowerCase().includes('mo813') || desc.toLowerCase().includes('mo813') || sku.toLowerCase().includes('mo813')) {
    matches.push({ sku, brand: wheel.brand_desc, style, desc: wheel.product_desc, diameter: wheel.diameter, width: wheel.width, finish: wheel.abbreviated_finish_desc || wheel.fancy_finish_desc, boltPattern: wheel.bolt_pattern_metric });
  }
}

console.log(`Found ${matches.length} MO813 SKUs in techfeed:\n`);
matches.sort((a, b) => (a.diameter || '').localeCompare(b.diameter || '') || (a.width || '').localeCompare(b.width || ''));
matches.forEach(m => console.log(`  ${m.sku} - ${m.brand} ${m.style} - ${m.diameter}x${m.width} - ${m.boltPattern} - ${m.finish}`));
