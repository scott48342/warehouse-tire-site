import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function checkDRWWheels() {
  console.log('=== DRW WHEEL OFFSET DISTRIBUTION ===\n');
  
  // Load the techfeed wheels data
  const filePath = path.join(__dirname, '..', 'src/techfeed/wheels_by_sku.json.gz');
  const buf = fs.readFileSync(filePath);
  const json = zlib.gunzipSync(buf).toString('utf8');
  const data = JSON.parse(json);
  
  const wheels = Object.values(data.bySku);
  console.log(`Total wheels in catalog: ${wheels.length}\n`);
  
  // Filter to HD bolt patterns (uppercase in catalog)
  const hdPatterns = ['8X180', '8X165.1', '8X170', '8X200', '8X210'];
  const hdWheels = wheels.filter(w => hdPatterns.includes(w.bolt_pattern_metric));
  console.log(`HD bolt pattern wheels (${hdPatterns.join(', ')}): ${hdWheels.length}\n`);
  
  // Analyze offset distribution
  const offsetBuckets = {
    'DRW Outer Extreme (<-150)': [],
    'DRW Outer (-150 to -50)': [],
    'Negative (-50 to 0)': [],
    'Mild (0 to 50)': [],
    'High (50 to 100)': [],
    'DRW Inner/Front (100+)': [],
    'Unknown': []
  };
  
  hdWheels.forEach(w => {
    const offset = parseFloat(w.offset);
    if (isNaN(offset)) {
      offsetBuckets['Unknown'].push(w);
    } else if (offset < -150) {
      offsetBuckets['DRW Outer Extreme (<-150)'].push(w);
    } else if (offset >= -150 && offset < -50) {
      offsetBuckets['DRW Outer (-150 to -50)'].push(w);
    } else if (offset >= -50 && offset < 0) {
      offsetBuckets['Negative (-50 to 0)'].push(w);
    } else if (offset >= 0 && offset < 50) {
      offsetBuckets['Mild (0 to 50)'].push(w);
    } else if (offset >= 50 && offset < 100) {
      offsetBuckets['High (50 to 100)'].push(w);
    } else {
      offsetBuckets['DRW Inner/Front (100+)'].push(w);
    }
  });
  
  console.log('=== OFFSET DISTRIBUTION ===');
  for (const [bucket, ws] of Object.entries(offsetBuckets)) {
    if (ws.length > 0) {
      const offsets = ws.map(w => parseFloat(w.offset)).filter(o => !isNaN(o));
      const min = offsets.length ? Math.min(...offsets) : 'N/A';
      const max = offsets.length ? Math.max(...offsets) : 'N/A';
      console.log(`  ${bucket}: ${ws.length} wheels (${min} to ${max})`);
    }
  }
  
  // Show sample DRW wheels (extreme offsets)
  console.log('\n=== SAMPLE DRW-POSITION WHEELS ===\n');
  
  // Outer (extreme negative)
  const outerWheels = [...offsetBuckets['DRW Outer Extreme (<-150)'], ...offsetBuckets['DRW Outer (-150 to -50)']];
  if (outerWheels.length > 0) {
    console.log('REAR OUTER (negative offset):');
    outerWheels.slice(0, 8).forEach(w => {
      console.log(`  ${String(w.offset).padStart(5)} | ${w.sku} | ${w.bolt_pattern_metric} | ${(w.product_desc || w.style || '').substring(0, 40)}`);
    });
  }
  
  // Inner/Front (high positive)
  const innerWheels = offsetBuckets['DRW Inner/Front (100+)'];
  if (innerWheels.length > 0) {
    console.log('\nFRONT/INNER (high positive offset):');
    innerWheels.slice(0, 8).forEach(w => {
      console.log(`  ${String(w.offset).padStart(5)} | ${w.sku} | ${w.bolt_pattern_metric} | ${(w.product_desc || w.style || '').substring(0, 40)}`);
    });
  }
  
  // Check for DRW/DUALLY in product names
  console.log('\n=== WHEELS WITH DRW/DUALLY IN NAME ===\n');
  const drwNamed = hdWheels.filter(w => {
    const name = (w.product_desc || w.style || '').toLowerCase();
    return name.includes('drw') || name.includes('dually');
  });
  
  if (drwNamed.length > 0) {
    drwNamed.sort((a, b) => parseFloat(a.offset) - parseFloat(b.offset));
    drwNamed.slice(0, 20).forEach(w => {
      console.log(`  ${String(w.offset).padStart(5)} | ${w.sku} | ${w.bolt_pattern_metric} | ${(w.product_desc || w.style || '').substring(0, 45)}`);
    });
    console.log(`  ... (${drwNamed.length} total DRW-named wheels)`);
  } else {
    console.log('  No wheels found with DRW/DUALLY in name');
  }
  
  // SRW vs DRW offset comparison
  console.log('\n=== SRW vs DRW OFFSET RANGES ===\n');
  const srwRange = hdWheels.filter(w => {
    const offset = parseFloat(w.offset);
    return !isNaN(offset) && offset >= -44 && offset <= 60;
  });
  const drwRange = hdWheels.filter(w => {
    const offset = parseFloat(w.offset);
    return !isNaN(offset) && (offset < -44 || offset > 60);
  });
  
  console.log(`SRW-compatible wheels (-44 to +60mm): ${srwRange.length}`);
  console.log(`DRW-specific wheels (outside SRW range): ${drwRange.length}`);
}

checkDRWWheels().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
