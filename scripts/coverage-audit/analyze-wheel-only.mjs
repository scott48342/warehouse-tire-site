/**
 * Analyze wheel-only vehicles to determine root causes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csv = fs.readFileSync(path.join(__dirname, 'wheel-only.csv'), 'utf8').split('\n').slice(1).filter(r => r.trim());

function parseRow(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (const c of line) {
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
    else { current += c; }
  }
  parts.push(current.trim());
  return {
    id: parts[0], year: parseInt(parts[1]), make: parts[2], model: parts[3], trim: parts[4],
    tireCount: parseInt(parts[5]), wheelCount: parseInt(parts[6]), packageCount: parseInt(parts[7]),
    category: parts[8], failureReason: parts[9], rootCause: parts[10], tireSizes: parts[11],
    boltPattern: parts[12], wheelDiams: parts[13]
  };
}

const vehicles = csv.map(parseRow).filter(v => v.year);

// Root cause breakdown
const byCause = {};
vehicles.forEach(v => {
  const cause = v.rootCause || 'unknown';
  byCause[cause] = byCause[cause] || { count: 0, makes: {}, models: {} };
  byCause[cause].count++;
  byCause[cause].makes[v.make] = (byCause[cause].makes[v.make] || 0) + 1;
});

// Analyze vintage_tire_size misclassification
const vintage = vehicles.filter(v => v.rootCause === 'vintage_tire_size');
const withPMetric = vintage.filter(v => /P\d{3}/.test(v.tireSizes || ''));
const withLT = vintage.filter(v => /LT\d{3}/.test(v.tireSizes || ''));
const withBoth = vintage.filter(v => /[PL]T?\d{3}/.test(v.tireSizes || ''));
const trueVintage = vintage.filter(v => !/[PL]T?\d{3}/.test(v.tireSizes || ''));

// Top affected makes/models for P-metric
const pMetricMakes = {};
const pMetricModels = {};
withPMetric.forEach(v => {
  pMetricMakes[v.make] = (pMetricMakes[v.make] || 0) + 1;
  pMetricModels[v.make + ' ' + v.model] = (pMetricModels[v.make + ' ' + v.model] || 0) + 1;
});

// LT-prefix analysis
const ltMakes = {};
withLT.forEach(v => {
  ltMakes[v.make] = (ltMakes[v.make] || 0) + 1;
});

console.log('='.repeat(70));
console.log('WHEEL-ONLY VEHICLES ANALYSIS REPORT');
console.log('='.repeat(70));
console.log('\nTotal Wheel-Only Vehicles:', vehicles.length);

console.log('\n--- ROOT CAUSE BREAKDOWN ---');
Object.entries(byCause).sort((a,b) => b[1].count - a[1].count).slice(0, 10).forEach(([cause, data]) => {
  console.log(`  ${cause}: ${data.count}`);
});

console.log('\n--- MISCLASSIFICATION ANALYSIS ---');
console.log('vintage_tire_size total:', vintage.length);
console.log('  - With P-metric prefix:', withPMetric.length);
console.log('  - With LT prefix:', withLT.length);
console.log('  - True vintage [E70-14 etc]:', trueVintage.length);
console.log('  - REGEX FIX IMPACT: +' + (withPMetric.length + withLT.length) + ' vehicles');

console.log('\n--- MODERN vs CLASSIC ---');
const modern = vehicles.filter(v => v.year >= 2015);
const classic = vehicles.filter(v => v.year < 2015);
console.log('Modern [2015+]:', modern.length);
console.log('Classic [pre-2015]:', classic.length);
console.log('Modern P-metric:', withPMetric.filter(v => v.year >= 2015).length);
console.log('Modern LT:', withLT.filter(v => v.year >= 2015).length);

console.log('\n--- TOP AFFECTED MAKES [P-metric] ---');
Object.entries(pMetricMakes).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([k,v]) => {
  console.log(`  ${k}: ${v}`);
});

console.log('\n--- TOP AFFECTED MAKES [LT prefix] ---');
Object.entries(ltMakes).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([k,v]) => {
  console.log(`  ${k}: ${v}`);
});

console.log('\n--- TOP AFFECTED MODELS [P-metric] ---');
Object.entries(pMetricModels).sort((a,b) => b[1]-a[1]).slice(0,15).forEach(([k,v]) => {
  console.log(`  ${k}: ${v}`);
});

console.log('\n--- RECOVERABLE ESTIMATE ---');
const recoverable = withPMetric.length + withLT.length;
console.log('Total misclassified as vintage:', recoverable);
console.log('Assumed inventory coverage 95%:', Math.round(recoverable * 0.95));
console.log('Revenue impact per vehicle: ~$800 avg order');
console.log('Potential revenue recovery: $' + Math.round(recoverable * 0.95 * 800).toLocaleString());

// Sample sizes for verification
console.log('\n--- SAMPLE P-METRIC SIZES TO VERIFY ---');
const sampleSizes = [...new Set(withPMetric.slice(0, 20).map(v => v.tireSizes))];
sampleSizes.slice(0, 10).forEach(s => console.log('  ', s));
