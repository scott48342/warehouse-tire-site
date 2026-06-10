import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load audit data
const failures = fs.readFileSync(path.join(__dirname, 'failure-analysis.csv'), 'utf8');
const vehicles = JSON.parse(fs.readFileSync(path.join(__dirname, 'vehicles.json')));

// Index vehicles by ID for offset lookup
const byId = new Map(vehicles.map(v => [v.id, v]));

// Parse CSV (skip header)
const lines = failures.split('\n').slice(1).filter(l => l.trim());

let packageGapCount = 0;
let noOffsetCount = 0;
let narrowOffsetCount = 0;
let vintageCount = 0;
let otherCount = 0;

const noOffsetVehicles = [];
const narrowOffsetVehicles = [];

for (const line of lines) {
  const parts = line.split(',');
  const id = parts[0];
  const rootCause = parts[10];
  
  if (rootCause !== 'package_generation_gap') continue;
  
  packageGapCount++;
  
  const v = byId.get(id);
  if (!v) continue;
  
  const hasOffset = v.offsetMin !== undefined && v.offsetMax !== undefined;
  const isVintage = (v.year || 0) < 1990;
  
  if (!hasOffset) {
    noOffsetCount++;
    if (noOffsetVehicles.length < 10) {
      noOffsetVehicles.push(`${v.year} ${v.make} ${v.model} ${v.trim}`);
    }
  } else {
    // Check if offset range is narrow (< 30mm spread)
    const spread = v.offsetMax - v.offsetMin;
    if (spread < 30) {
      narrowOffsetCount++;
      if (narrowOffsetVehicles.length < 10) {
        narrowOffsetVehicles.push(`${v.year} ${v.make} ${v.model} (${v.offsetMin}-${v.offsetMax})`);
      }
    } else {
      otherCount++;
    }
  }
  
  if (isVintage) vintageCount++;
}

console.log('Package Generation Gap Analysis');
console.log('================================');
console.log('Total package_generation_gap failures:', packageGapCount);
console.log('');
console.log('Breakdown:');
console.log('  Missing offset data (defaults to 20-50):', noOffsetCount, `(${(100*noOffsetCount/packageGapCount).toFixed(1)}%)`);
console.log('  Has offset but narrow range (<30mm):', narrowOffsetCount);
console.log('  Has wide offset range (other causes):', otherCount);
console.log('');
console.log('Vintage vehicles (pre-1990):', vintageCount, `(${(100*vintageCount/packageGapCount).toFixed(1)}%)`);
console.log('');
console.log('Sample vehicles with missing offset:');
noOffsetVehicles.forEach(v => console.log('  -', v));
console.log('');
console.log('Sample vehicles with narrow offset:');
narrowOffsetVehicles.forEach(v => console.log('  -', v));
