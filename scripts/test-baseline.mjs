#!/usr/bin/env node
/**
 * Test OEM baseline calculation for F-150
 */

function parseTireSize(size) {
  // LT prefix handling
  const cleanSize = size.replace(/^LT/i, '');
  const match = cleanSize.match(/^(\d{3})\/(\d{2,3})R(\d{2})/);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      aspectRatio: parseInt(match[2], 10),
      rimDiameter: parseInt(match[3], 10),
      original: size,
    };
  }
  return null;
}

function calculateOverallDiameter(width, aspectRatio, rimDiameter) {
  const sidewallMm = width * (aspectRatio / 100);
  const sidewallInches = sidewallMm / 25.4;
  return rimDiameter + (2 * sidewallInches);
}

// F-150 OEM tire sizes
const oemTireSizes = [
  "245/70R17",
  "265/70R17", 
  "275/65R18",
  "LT265/70R18",
  "LT315/70R17"  // <-- This is the problem!
];

console.log('F-150 OEM Tire Size Analysis\n');
console.log('Size'.padEnd(15), 'Rim'.padStart(4), 'OD (in)'.padStart(8));
console.log('-'.repeat(30));

const byRim = {};

for (const size of oemTireSizes) {
  const parsed = parseTireSize(size);
  if (!parsed) {
    console.log(`${size.padEnd(15)} - Failed to parse`);
    continue;
  }
  
  const od = calculateOverallDiameter(parsed.width, parsed.aspectRatio, parsed.rimDiameter);
  console.log(`${size.padEnd(15)} ${parsed.rimDiameter.toString().padStart(4)} ${od.toFixed(1).padStart(8)}`);
  
  // Track max per rim
  if (!byRim[parsed.rimDiameter] || od > byRim[parsed.rimDiameter]) {
    byRim[parsed.rimDiameter] = od;
  }
}

console.log('\n--- MAX OD by Rim (new code uses this) ---');
for (const [rim, od] of Object.entries(byRim)) {
  console.log(`  ${rim}": ${od.toFixed(1)}"`);
}

console.log('\n--- Validation Example ---');
const standardTire = parseTireSize("245/70R17");
const standardOD = calculateOverallDiameter(standardTire.width, standardTire.aspectRatio, standardTire.rimDiameter);

const prodBaseline = standardOD; // Old code uses first tire
const localBaseline = byRim[17]; // New code uses MAX per rim

console.log(`Standard package: 245/70R17 (OD: ${standardOD.toFixed(1)}")`);
console.log(`Production baseline (first tire): ${prodBaseline.toFixed(1)}"`);
console.log(`Local baseline (max for 17"): ${localBaseline.toFixed(1)}"`);

const prodChange = ((standardOD - prodBaseline) / prodBaseline) * 100;
const localChange = ((standardOD - localBaseline) / localBaseline) * 100;

console.log(`\nProduction diameter change: ${prodChange.toFixed(1)}% ${Math.abs(prodChange) <= 3 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Local diameter change: ${localChange.toFixed(1)}% ${Math.abs(localChange) <= 3 ? '✅ PASS' : '❌ FAIL'}`);

console.log('\n🐛 BUG CONFIRMED: LT315/70R17 is inflating the 17" baseline!');
console.log('Fix: Exclude LT sizes from baseline calculation, or use first/primary size.');
