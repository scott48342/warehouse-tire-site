import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const filePath = path.join(__dirname, '..', 'src', 'techfeed', 'wheels_by_sku.json.gz');
  console.log('Loading from:', filePath);
  
  const buf = await fs.readFile(filePath);
  const json = zlib.gunzipSync(buf).toString('utf8');
  const data = JSON.parse(json);
  
  console.log('Techfeed has', Object.keys(data.bySku || {}).length, 'wheels');
  
  // Look for XD860 which is the "LEGACY" style from XD Wheels
  const xd860Wheels = [];
  
  for (const [sku, wheel] of Object.entries(data.bySku || {})) {
    const desc = (wheel.product_desc || '').toLowerCase();
    const style = (wheel.style || wheel.display_style_no || '').toLowerCase();
    
    if (desc.includes('xd860') || sku.toLowerCase().includes('xd860')) {
      xd860Wheels.push(wheel);
    }
  }
  
  console.log('\nXD860 (Legacy) wheels:', xd860Wheels.length);
  
  // Group by unique specs
  const uniqueSpecs = new Set();
  xd860Wheels.forEach(w => {
    const key = `${w.diameter}x${w.width} offset=${w.offset} bolt=${w.bolt_pattern_metric}`;
    uniqueSpecs.add(key);
  });
  
  console.log('Unique specs:', uniqueSpecs.size);
  console.log('\nAll specs:', Array.from(uniqueSpecs).slice(0, 20));
  
  // Check if any are missing data
  const missingData = xd860Wheels.filter(w => !w.diameter || !w.width || w.offset === undefined || w.offset === null);
  console.log('\nWheels missing diameter/width/offset:', missingData.length);
  if (missingData.length > 0) {
    console.log('Missing samples:', missingData.slice(0, 3).map(w => ({
      sku: w.sku,
      diameter: w.diameter,
      width: w.width,
      offset: w.offset
    })));
  }
}

main().catch(console.error);
