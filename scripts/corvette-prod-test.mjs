#!/usr/bin/env node
/**
 * Corvette Production Tests
 * 
 * Tests all Corvette variants in production.
 */

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

const CORVETTES = [
  { year: 2024, trim: 'Stingray', expected: { front: '245/35ZR19', rear: '305/30ZR20' } },
  { year: 2024, trim: 'Z06', expected: { front: '275/30ZR20', rear: '345/25ZR21' } },
  { year: 2024, trim: 'E-Ray', expected: { front: '275/30ZR20', rear: '345/25ZR21' } },
  { year: 2025, trim: 'Stingray', expected: { front: '245/35ZR19', rear: '305/30ZR20' } },
  { year: 2025, trim: 'Z06', expected: { front: '275/30ZR20', rear: '345/25ZR21' } },
  { year: 2025, trim: 'E-Ray', expected: { front: '275/30ZR20', rear: '345/25ZR21' } },
];

async function testCorvettes() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   CORVETTE PRODUCTION TESTS                                  ║');
  console.log(`║   Target: ${BASE_URL.slice(0, 45).padEnd(45)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  console.log('=== Tire Sizes API ===\n');

  for (const c of CORVETTES) {
    const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${c.year}&make=Chevrolet&model=Corvette&trim=${encodeURIComponent(c.trim)}`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.log(`❌ ${c.year} Corvette ${c.trim}: ERROR - ${data.error}`);
        failed++;
        continue;
      }

      const sizes = data.tireSizes || [];
      const normalizedSizes = sizes.map(s => s.replace(/^P/, ''));
      const hasStaggered = data.staggered?.isStaggered;
      
      // Check expected sizes
      const expectedFrontNorm = c.expected.front.replace(/^P/, '');
      const expectedRearNorm = c.expected.rear.replace(/^P/, '');
      const hasExpectedFront = normalizedSizes.includes(expectedFrontNorm) || sizes.includes(c.expected.front);
      const hasExpectedRear = normalizedSizes.includes(expectedRearNorm) || sizes.includes(c.expected.rear);

      if (sizes.length > 0 && hasExpectedFront && hasExpectedRear) {
        console.log(`✅ ${c.year} Corvette ${c.trim}: ${sizes.length} sizes, staggered=${hasStaggered}`);
        passed++;
      } else if (sizes.length > 0) {
        console.log(`⚠️  ${c.year} Corvette ${c.trim}: ${sizes.length} sizes but missing expected`);
        console.log(`   Expected: ${c.expected.front}, ${c.expected.rear}`);
        console.log(`   Got: ${sizes.join(', ')}`);
        failed++;
      } else {
        console.log(`❌ ${c.year} Corvette ${c.trim}: No tire sizes`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${c.year} Corvette ${c.trim}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n=== Wheel Fitment Search ===\n');

  for (const c of CORVETTES) {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${c.year}&make=Chevrolet&model=Corvette&trim=${encodeURIComponent(c.trim)}`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.log(`❌ ${c.year} Corvette ${c.trim}: ERROR - ${data.error}`);
        failed++;
        continue;
      }

      const wheelCount = data.wheels?.length || data.results?.length || 0;
      console.log(`✅ ${c.year} Corvette ${c.trim}: ${wheelCount} wheels`);
      passed++;
    } catch (err) {
      console.log(`❌ ${c.year} Corvette ${c.trim}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`SUMMARY: ${passed}/${passed + failed} passed`);
  
  if (failed === 0) {
    console.log('\n✅ ALL CORVETTE TESTS PASSED\n');
    process.exit(0);
  } else {
    console.log(`\n❌ ${failed} TESTS FAILED\n`);
    process.exit(1);
  }
}

testCorvettes().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
