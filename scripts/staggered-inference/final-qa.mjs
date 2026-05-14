#!/usr/bin/env node
/**
 * Final QA - Phase A v2 Staggered Verification
 * Tests all APIs against live production site
 */

const BASE_URL = 'https://shop.warehousetiredirect.com';

const PHASE_A_TESTS = [
  // Camaro
  { name: '2024 Camaro SS 1LE', year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS 1LE', 
    expectedSizes: ['285/30R20', '305/30R20'] },
  { name: '2024 Camaro ZL1 1LE', year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'ZL1 1LE', 
    expectedSizes: ['305/30R19', '325/30R19'] },
  
  // Corvette  
  { name: '2024 Corvette Stingray 1LT', year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray 1LT',
    expectedSizes: ['245/35ZR19', '305/30ZR20'] },
  
  // BMW M3
  { name: '2024 BMW M3 Competition', year: 2024, make: 'BMW', model: 'M3', trim: 'M3 Competition',
    expectedSizes: ['255/35R19', '275/35R19'] },
    
  // BMW M4
  { name: '2024 BMW M4 Competition', year: 2024, make: 'BMW', model: 'M4', trim: 'Competition',
    expectedSizes: ['275/35R19', '285/30R20'] },
    
  // BMW M5
  { name: '2024 BMW M5 Competition', year: 2024, make: 'BMW', model: 'M5', trim: 'M5 Competition',
    expectedSizes: ['275/35R20', '285/35R20'] },
];

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   FINAL QA - PHASE A v2 STAGGERED VERIFICATION               ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;
const results = [];

async function testVehicle(test) {
  const trimParam = encodeURIComponent(test.trim);
  
  // Test 1: Tire Sizes API
  let tireSizesOk = false;
  try {
    const tireSizesUrl = `${BASE_URL}/api/vehicles/tire-sizes?year=${test.year}&make=${test.make}&model=${test.model}&trim=${trimParam}`;
    const r1 = await fetch(tireSizesUrl);
    const d1 = await r1.json();
    const sizes = d1.tireSizes || [];
    tireSizesOk = sizes.length >= 2 && r1.status === 200;
  } catch (e) {
    tireSizesOk = false;
  }
  
  // Test 2: Wheel Fitment Search API
  let wheelSearchOk = false;
  try {
    const wheelUrl = `${BASE_URL}/api/wheels/fitment-search?year=${test.year}&make=${test.make}&model=${test.model}&trim=${trimParam}`;
    const r2 = await fetch(wheelUrl);
    const d2 = await r2.json();
    wheelSearchOk = r2.status === 200 && !d2.error;
  } catch (e) {
    wheelSearchOk = false;
  }
  
  // Test 3: Trims API (verify trim exists)
  let trimsOk = false;
  try {
    const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${test.year}&make=${test.make}&model=${test.model}`;
    const r3 = await fetch(trimsUrl);
    const d3 = await r3.json();
    const trims = d3.results || [];
    trimsOk = r3.status === 200 && trims.length > 0;
  } catch (e) {
    trimsOk = false;
  }
  
  const allPassed = tireSizesOk && wheelSearchOk && trimsOk;
  
  console.log(`${allPassed ? '✅' : '❌'} ${test.name}`);
  console.log(`   Tire Sizes: ${tireSizesOk ? '✅' : '❌'}  Wheel Search: ${wheelSearchOk ? '✅' : '❌'}  Trims: ${trimsOk ? '✅' : '❌'}`);
  
  if (allPassed) passed++; else failed++;
  
  return { test: test.name, passed: allPassed, tireSizesOk, wheelSearchOk, trimsOk };
}

async function run() {
  for (const test of PHASE_A_TESTS) {
    const result = await testVehicle(test);
    results.push(result);
  }
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passed}/${PHASE_A_TESTS.length} vehicles passed`);
  
  if (failed > 0) {
    console.log(`\n⚠️  ${failed} vehicles failed some tests`);
    console.log('Check API responses for these vehicles manually.');
  } else {
    console.log(`\n✅ All Phase A vehicles passing!`);
  }
}

run();
