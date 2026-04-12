import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function checkBoltPatterns() {
  // Load the techfeed wheels data
  const filePath = path.join(__dirname, '..', 'src/techfeed/wheels_by_sku.json.gz');
  const buf = fs.readFileSync(filePath);
  const json = zlib.gunzipSync(buf).toString('utf8');
  const data = JSON.parse(json);
  
  const wheels = Object.values(data.bySku);
  console.log(`Total wheels: ${wheels.length}\n`);
  
  // Count by bolt pattern
  const patternCounts = {};
  wheels.forEach(w => {
    const bp = w.bolt_pattern_metric || 'unknown';
    patternCounts[bp] = (patternCounts[bp] || 0) + 1;
  });
  
  // Sort by count
  const sorted = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]);
  
  console.log('=== BOLT PATTERN DISTRIBUTION ===\n');
  sorted.forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}`);
  });
  
  // Look for HD patterns specifically
  console.log('\n=== HD BOLT PATTERNS ===');
  const hdPatterns = ['8x180', '8x165.1', '8x165', '8x170', '8x200', '8x210', '8x6.5'];
  hdPatterns.forEach(p => {
    const count = patternCounts[p] || 0;
    console.log(`  ${p}: ${count}`);
  });
  
  // Check for any 8-lug patterns
  console.log('\n=== ALL 8-LUG PATTERNS ===');
  sorted.filter(([p]) => p.startsWith('8x')).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}`);
  });
}

checkBoltPatterns();
