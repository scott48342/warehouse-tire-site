#!/usr/bin/env node
/**
 * Wheel Fitment Verification - Staggered Platforms
 * Verifies wheel fitment search works correctly for Phase A platforms
 */

const BASE_URL = 'https://shop.warehousetiredirect.com';

const tests = [
  {
    name: '2024 Camaro SS wheel search',
    params: 'year=2024&make=Chevrolet&model=Camaro&trim=SS',
    expectBoltPattern: '5x120',
    expectDiameters: [20],
  },
  {
    name: '2024 Corvette Stingray wheel search',
    params: 'year=2024&make=Chevrolet&model=Corvette&trim=Stingray%201LT',
    expectBoltPattern: '5x120',
    expectDiameters: [19, 20],
  },
  {
    name: '2024 BMW M4 Competition wheel search',
    params: 'year=2024&make=BMW&model=M4&trim=Competition',
    expectBoltPattern: '5x112',
    expectDiameters: [19, 20],
  },
  {
    name: '2024 BMW M5 Competition wheel search',
    params: 'year=2024&make=BMW&model=M5&trim=M5%20Competition',
    expectBoltPattern: '5x112',
    expectDiameters: [20],
  },
];

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   WHEEL FITMENT VERIFICATION                                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;
const results = [];

for (const test of tests) {
  try {
    const url = `${BASE_URL}/api/wheels/fitment-search?${test.params}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const issues = [];
    
    // Check bolt pattern
    if (data.boltPattern && data.boltPattern !== test.expectBoltPattern) {
      issues.push(`Bolt pattern: expected ${test.expectBoltPattern}, got ${data.boltPattern}`);
    }
    
    // Check available wheel diameters
    const availableDiameters = data.availableWheelDiameters || [];
    const hasDiameters = test.expectDiameters.every(d => availableDiameters.includes(d));
    if (!hasDiameters) {
      issues.push(`Diameters: expected ${test.expectDiameters.join(',')}, got ${availableDiameters.join(',')}`);
    }
    
    // Check staggered flag
    const isStaggered = data.isStaggered;
    
    // Check we got wheel results
    const wheelCount = (data.wheels || []).length;
    
    if (issues.length === 0) {
      console.log(`✅ ${test.name}`);
      console.log(`   Bolt: ${data.boltPattern} | Diameters: ${availableDiameters.join(', ')}" | Staggered: ${isStaggered} | Wheels: ${wheelCount}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      for (const issue of issues) {
        console.log(`   ⚠️  ${issue}`);
      }
      failed++;
    }
    
    results.push({
      test: test.name,
      status: issues.length === 0 ? 'pass' : 'fail',
      boltPattern: data.boltPattern,
      diameters: availableDiameters,
      isStaggered,
      wheelCount,
      issues,
    });
    
  } catch (err) {
    console.log(`❌ ${test.name} - ${err.message}`);
    failed++;
    results.push({
      test: test.name,
      status: 'error',
      error: err.message,
    });
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed}/${tests.length} passed`);

if (failed > 0) {
  console.log(`\n⚠️  ${failed} tests failed/have issues`);
} else {
  console.log(`\n✅ All wheel fitment tests passed!`);
}

// Output detailed results
console.log('\n📋 Detailed Results:');
console.log(JSON.stringify(results, null, 2));
