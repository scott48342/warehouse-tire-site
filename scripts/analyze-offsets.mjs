import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(readFileSync(resolve(__dirname, 'european-vehicles-raw.json'), 'utf8'));

// Try to extract offset from oem_wheel_sizes JSON
function extractOffset(wheelsJson) {
  if (!wheelsJson) return null;
  try {
    const wheels = typeof wheelsJson === 'string' ? JSON.parse(wheelsJson) : wheelsJson;
    if (!Array.isArray(wheels)) return null;
    const offsets = [];
    for (const w of wheels) {
      if (typeof w === 'object' && w !== null && typeof w.offset === 'number') {
        offsets.push(w.offset);
      }
    }
    if (offsets.length === 0) return null;
    return offsets;
  } catch {
    return null;
  }
}

const hasEmbedded = [];
const needsLookup = [];

for (const row of rows) {
  const offsets = extractOffset(row.wheels);
  if (offsets && offsets.length > 0) {
    hasEmbedded.push({ ...row, extractedOffsets: offsets });
  } else {
    needsLookup.push(row);
  }
}

process.stdout.write(`\nHas embedded offsets: ${hasEmbedded.length}\n`);
process.stdout.write(`Needs lookup: ${needsLookup.length}\n\n`);

process.stdout.write('=== NEEDS LOOKUP ===\n');
for (const r of needsLookup) {
  process.stdout.write(`${r.make} | ${r.model} | ${r.year_from}-${r.year_to} | bp=${r.bolt_pattern} | cnt=${r.cnt} | wheels=${r.wheels?.substring(0,60)}\n`);
}

process.stdout.write('\n=== HAS EMBEDDED (sample) ===\n');
for (const r of hasEmbedded.slice(0, 20)) {
  process.stdout.write(`${r.make} | ${r.model} | ${r.year_from}-${r.year_to} | offsets=${JSON.stringify(r.extractedOffsets)}\n`);
}

writeFileSync(resolve(__dirname, 'needs-lookup.json'), JSON.stringify(needsLookup, null, 2));
writeFileSync(resolve(__dirname, 'has-embedded.json'), JSON.stringify(hasEmbedded, null, 2));
