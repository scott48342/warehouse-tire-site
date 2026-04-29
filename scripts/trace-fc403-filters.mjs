import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load techfeed
const techfeedPath = path.join(__dirname, '..', 'src', 'techfeed', 'wheels_by_sku.json.gz');
const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(techfeedPath)));

const sku = 'FC403PB20905001';
const c = data.bySku[sku];

console.log('=== FC403PB20905001 Filter Trace ===\n');

// 1. Bolt pattern index lookup
const bpNormalized = (c.bolt_pattern_metric || '').toLowerCase().replace(/\s/g, '').replace(/[×-]/g, 'x');
console.log('1. Bolt Pattern Lookup');
console.log('   Raw:', c.bolt_pattern_metric);
console.log('   Normalized:', bpNormalized);
console.log('   Match "5x127":', bpNormalized === '5x127' ? '✅' : '❌');

// 2. Basic filters
console.log('\n2. Basic Filters (no brand/finish/diameter/width selected)');

// 3. Pricing check
const msrp = Number(c.msrp) || 0;
const map = Number(c.map_price) || 0;
const p = (map > 0 || msrp > 100) ? Math.max(map, msrp) : 0;
console.log('   MSRP:', msrp);
console.log('   MAP:', map);
console.log('   Calculated price:', p);
console.log('   Price > 0:', p > 0 ? '✅' : '❌');

// 4. Discontinued check
const desc = (c.product_desc || '').toLowerCase();
console.log('   Discontinued:', desc.includes('discontinued') ? '❌ FILTERED' : '✅ Not discontinued');

// 5. Fitment validation
console.log('\n3. Fitment Validation');
const diameter = Number(c.diameter);
const width = Number(c.width);
const offset = Number(c.offset);
const centerbore = Number(c.centerbore);

// 2014 Grand Cherokee envelope (from API response)
const envelope = {
  allowedMinDiameter: 17,
  allowedMaxDiameter: 24,
  allowedMinWidth: 7,
  allowedMaxWidth: 12,
  allowedMinOffset: -13.6,
  allowedMaxOffset: 81.4,
  vehicleType: 'suv'
};

// Diameter check
const safetyFloor = envelope.vehicleType === 'suv' ? 17 : 15;
const safetyCeiling = Math.min(28, 24 + 8); // oemMaxDiameter + 8
console.log('   Diameter:', diameter);
console.log('   Safety floor/ceiling:', safetyFloor, '-', safetyCeiling);
console.log('   Diameter valid:', (diameter >= safetyFloor && diameter <= safetyCeiling) ? '✅' : '❌');

// Width check
console.log('   Width:', width);
console.log('   Width range:', envelope.allowedMinWidth, '-', envelope.allowedMaxWidth);
console.log('   Width valid:', (width >= envelope.allowedMinWidth && width <= envelope.allowedMaxWidth) ? '✅' : '❌');

// Offset check
console.log('   Offset:', offset);
console.log('   Offset range:', envelope.allowedMinOffset, '-', envelope.allowedMaxOffset);
console.log('   Offset valid:', (offset >= envelope.allowedMinOffset && offset <= envelope.allowedMaxOffset) ? '✅' : '❌');

// Centerbore check
console.log('   Centerbore:', centerbore);
console.log('   Vehicle hub bore: 71.6mm');
console.log('   Centerbore valid:', (centerbore >= 71.6) ? '✅' : '❌');

console.log('\n=== All checks passed? Should appear in results! ===');
console.log('\nIf not appearing, check:');
console.log('- Is it in the diversified candidate list?');
console.log('- Is it being filtered by inventory?');
