#!/usr/bin/env node
const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

const VEHICLES = [
  // BMW M3 CS
  { year: 2024, make: 'BMW', model: 'M3', trim: 'M3 CS', expected: { front: '275/35ZR19', rear: '285/30ZR20' } },
  { year: 2023, make: 'BMW', model: 'M3', trim: 'M3 CS', expected: { front: '275/35ZR19', rear: '285/30ZR20' } },
  // Mustang GT
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT Performance Package', expected: { front: '255/40R19', rear: '275/40R19' } },
  // Shelby GT500
  { year: 2023, make: 'Ford', model: 'Mustang', trim: 'Shelby GT500', expected: { front: '305/30ZR20', rear: '315/30ZR20' } },
  { year: 2020, make: 'Ford', model: 'Mustang', trim: 'Shelby GT500', expected: { front: '305/30ZR20', rear: '315/30ZR20' } },
  // Shelby GT350
  { year: 2020, make: 'Ford', model: 'Mustang', trim: 'Shelby GT350', expected: { front: '295/35ZR19', rear: '305/35ZR19' } },
];

async function test() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   MUSTANG + BMW M3 CS PRODUCTION TESTS                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let passed = 0, failed = 0;

  for (const v of VEHICLES) {
    const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&trim=${encodeURIComponent(v.trim)}`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.log(`❌ ${v.year} ${v.make} ${v.model} ${v.trim}: ${data.error}`);
        failed++;
        continue;
      }

      const sizes = data.tireSizes || [];
      const norm = s => s.replace(/^P/, '').replace('ZR', 'R').toUpperCase();
      const normalizedSizes = sizes.map(norm);
      
      const hasFront = normalizedSizes.includes(norm(v.expected.front));
      const hasRear = normalizedSizes.includes(norm(v.expected.rear));
      const isStaggered = data.staggered?.isStaggered;

      if (sizes.length > 0 && hasFront && hasRear) {
        console.log(`✅ ${v.year} ${v.make} ${v.model} ${v.trim}: ${sizes.length} sizes, staggered=${isStaggered}`);
        passed++;
      } else {
        console.log(`❌ ${v.year} ${v.make} ${v.model} ${v.trim}: Missing expected sizes`);
        console.log(`   Expected: ${v.expected.front}, ${v.expected.rear}`);
        console.log(`   Got: ${sizes.join(', ')}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${v.year} ${v.make} ${v.model} ${v.trim}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`RESULT: ${passed}/${passed + failed} passed`);
  
  if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED\n');
  } else {
    console.log(`\n❌ ${failed} FAILED\n`);
    process.exit(1);
  }
}

test().catch(err => { console.error(err); process.exit(1); });
