import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load techfeed
const techfeedPath = path.join(__dirname, '..', 'src', 'techfeed', 'wheels_by_sku.json.gz');
const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(techfeedPath)));

const sku = 'FC403PB20905001';
const wheel = data.bySku[sku];

if (!wheel) {
  console.log('SKU not found in techfeed');
  process.exit(1);
}

console.log('FC403 BURN Specs from Techfeed:');
console.log(`  SKU: ${wheel.sku}`);
console.log(`  Diameter: ${wheel.diameter}"`);
console.log(`  Width: ${wheel.width}"`);
console.log(`  Offset: ${wheel.offset}mm`);
console.log(`  Centerbore: ${wheel.centerbore}mm`);
console.log(`  Bolt Pattern: ${wheel.bolt_pattern_metric} (${wheel.bolt_pattern_standard})`);

// Simulate fitment check for 2014 Grand Cherokee (no DB data, using defaults)
console.log('\n--- Simulating Fitment Check ---');

// Default OEM envelope (no 2014 GC data)
const oemMinOffset = 20;  // default fallback
const oemMaxOffset = 50;  // default fallback

// Aggressive mode expansion
const offsetExpandLow = 70;
const offsetExpandHigh = 25;

const allowedMinOffset = oemMinOffset - offsetExpandLow;  // -50
const allowedMaxOffset = oemMaxOffset + offsetExpandHigh;  // 75

console.log(`OEM Offset Range: +${oemMinOffset} to +${oemMaxOffset}mm`);
console.log(`Aggressive Mode Expansion: -${offsetExpandLow} / +${offsetExpandHigh}`);
console.log(`Allowed Offset Range: ${allowedMinOffset} to +${allowedMaxOffset}mm`);
console.log(`FC403 Offset: +${wheel.offset}mm`);

const wheelOffset = parseFloat(wheel.offset);
if (wheelOffset >= allowedMinOffset && wheelOffset <= allowedMaxOffset) {
  console.log(`✅ Offset PASSES fitment check`);
} else {
  console.log(`❌ Offset FAILS fitment check`);
}

// Check bolt pattern
console.log(`\nBolt Pattern: ${wheel.bolt_pattern_metric}`);
console.log(`2014 Grand Cherokee: 5x127 (5x5)`);
if (wheel.bolt_pattern_metric === '5X127') {
  console.log(`✅ Bolt pattern matches`);
} else {
  console.log(`❌ Bolt pattern does NOT match`);
}

// Check centerbore
console.log(`\nCenterbore: ${wheel.centerbore}mm`);
console.log(`2014 Grand Cherokee: 71.5mm`);
if (parseFloat(wheel.centerbore) >= 71.5) {
  console.log(`✅ Centerbore OK (wheel bore >= vehicle hub)`);
} else {
  console.log(`❌ Centerbore too small`);
}
