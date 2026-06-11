/**
 * Analyze remaining package_generation_gap vehicles
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-results.json')));
const vehicles = JSON.parse(fs.readFileSync(path.join(__dirname, 'vehicles.json')));
const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'probe-state.json')));

const gap = results.filter(r => r.root_cause === 'package_generation_gap');
const vmap = {};
for (const v of vehicles) vmap[v.id] = v;

// Better tire diameter parsing
function parseTireRimDiameter(size) {
  const match = size.match(/R(\d{2})/i);
  return match ? parseInt(match[1]) : null;
}

console.log('Total package_generation_gap:', gap.length);

let noOverlap = 0;
let partialOverlap = 0;
let fullOverlap = 0;
const fullOverlapSamples = [];

for (const r of gap) {
  const v = vmap[r.id];
  if (!v) continue;
  
  const tireDiams = new Set();
  for (const size of v.modernTireSizes || []) {
    const d = parseTireRimDiameter(size);
    if (d) tireDiams.add(d);
  }
  
  const wheelDiams = new Set(v.wheelDiams || []);
  const overlap = [...tireDiams].filter(d => wheelDiams.has(d));
  
  if (overlap.length === 0) {
    noOverlap++;
  } else if (overlap.length < wheelDiams.size) {
    partialOverlap++;
  } else {
    fullOverlap++;
    if (fullOverlapSamples.length < 20) {
      const wc = state.wheels[v.wheelClass];
      fullOverlapSamples.push({
        vehicle: r.year + ' ' + r.make + ' ' + r.model + ' ' + r.trim,
        wheelDiams: [...wheelDiams].join(','),
        tireDiams: [...tireDiams].join(','),
        tireSizes: (v.modernTireSizes || []).slice(0, 3).join(', '),
        wheelClass: v.wheelClass,
        wheelCount: wc?.count || 0,
        tireCount: r.tire_count,
      });
    }
  }
}

console.log('\nOverlap breakdown:');
console.log('  No overlap (missing data):', noOverlap);
console.log('  Partial overlap:', partialOverlap);
console.log('  FULL overlap (should work!):', fullOverlap);

console.log('\nFull-overlap samples (should generate packages):');
fullOverlapSamples.forEach(d => {
  console.log('  ' + d.vehicle);
  console.log('    wheels:', d.wheelDiams, '| tires:', d.tireDiams);
  console.log('    tires:', d.tireSizes);
  console.log('    wheelClass:', d.wheelClass, '| wheelCount:', d.wheelCount, '| tireCount:', d.tireCount);
});

// Group full overlap by wheel class
const fullOverlapByClass = {};
for (const r of gap) {
  const v = vmap[r.id];
  if (!v) continue;
  
  const tireDiams = new Set();
  for (const size of v.modernTireSizes || []) {
    const d = parseTireRimDiameter(size);
    if (d) tireDiams.add(d);
  }
  
  const wheelDiams = new Set(v.wheelDiams || []);
  const overlap = [...tireDiams].filter(d => wheelDiams.has(d));
  
  if (overlap.length > 0 && overlap.length >= wheelDiams.size) {
    fullOverlapByClass[v.wheelClass] = (fullOverlapByClass[v.wheelClass] || 0) + 1;
  }
}

console.log('\nFull-overlap by wheel class:');
Object.entries(fullOverlapByClass).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  const pkgState = state.packages[k];
  console.log('  ' + k + ': ' + v + ' vehicles (pkgProbe=' + (pkgState?.count ?? 'N/A') + ')');
});
