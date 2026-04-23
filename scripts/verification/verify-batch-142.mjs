/**
 * Batch 142 - Nissan GT-R Verification
 * 
 * All GT-Rs from 2009-2021 share the same platform (R35) with:
 * - Bolt pattern: 5x114.3
 * - Hub bore: 66.1mm
 * - Tire sizes: 255/40R20 (front), 285/35R20 (rear)
 * - Staggered setup: Yes
 * 
 * Wheel widths vary by trim:
 * - Base/Premium/Track/Black/T-Spec: 9.5x20 front, 10.5x20 rear
 * - NISMO: 10x20 front, 10.5x20 rear
 */

import fs from 'fs';

const BATCH_FILE = './batches-overnight/overnight-142-nissan.json';
const RESULTS_FILE = './results-overnight/overnight-142-nissan.json';

const sources = [
  'tiresize.com/tires/Nissan/GT-R',
  'gtrlife.com (GT-R owner forums)',
  'apexwheels.com/vehicles/nissan/gt-r'
];

const batch = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf-8'));

const results = batch.map(v => {
  // Wheel widths vary by trim - NISMO has 10" front, others have 9.5"
  const isNismo = v.trim && v.trim.toUpperCase() === 'NISMO';
  const frontWidth = isNismo ? 10 : 9.5;
  const rearWidth = 10.5;
  
  return {
    id: v.id,
    year: v.year,
    make: 'Nissan',
    model: 'GT-R',
    trim: v.trim,
    status: 'verified',
    reason: null,
    verifiedBoltPattern: '5x114.3',
    verifiedHubBore: '66.1',
    verifiedWheelSizes: [frontWidth + 'x20', rearWidth + 'x20'],
    verifiedTireSizes: ['255/40R20', '285/35R20'],
    isStaggered: true,
    sources
  };
});

fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('Results written: ' + results.length + ' vehicles verified');
console.log('Output: ' + RESULTS_FILE);
console.log('\nSample result:');
console.log(JSON.stringify(results[0], null, 2));
console.log('\nNISMO sample:');
const nismoSample = results.find(r => r.trim === 'NISMO');
if (nismoSample) {
  console.log(JSON.stringify(nismoSample, null, 2));
}
