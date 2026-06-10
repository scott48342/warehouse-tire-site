import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const gz = fs.readFileSync(path.join(ROOT, 'src', 'techfeed', 'wheels_by_sku.json.gz'));
const bySku = JSON.parse(zlib.gunzipSync(gz).toString('utf8')).bySku || {};
const norm = bp => String(bp || '').toLowerCase().replace(/\s/g, '').replace(/[x-]/g, 'x').trim();
const keys = new Map();
const diamsByKey = new Map();
for (const w of Object.values(bySku)) {
  const bpRaw = w.bolt_pattern_metric || w.bolt_pattern_standard || '';
  for (const part of String(bpRaw).trim().split(/[\/,]/)) {
    const k = norm(part);
    if (!k) continue;
    keys.set(k, (keys.get(k) || 0) + 1);
    if (!diamsByKey.has(k)) diamsByKey.set(k, new Set());
    diamsByKey.get(k).add(Math.round(Number(w.diameter) || 0));
  }
}
console.log('all techfeed bolt keys:');
for (const [k, n] of [...keys.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k} → ${n} skus, diameters: ${[...diamsByKey.get(k)].sort((a, b) => a - b).join(',')}`);
}
// raw samples
const raws = new Set();
for (const w of Object.values(bySku).slice(0, 100000)) {
  if (w.bolt_pattern_metric) raws.add(w.bolt_pattern_metric);
  if (raws.size > 25) break;
}
console.log('\nraw bolt_pattern_metric samples:', [...raws].slice(0, 25));
