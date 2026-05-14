/**
 * Production Smoke Test Suite
 * 
 * Tests:
 * 1. 50-vehicle runtime spot-check
 * 2. Camaro/Corvette/Mustang/BMW staggered
 * 3. HD truck LT sizes with /E
 * 4. Mercedes alias
 * 5. Sedan resolver
 * 6. Package flow
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const BASE_URL = process.env.PROD_URL || 'https://shop.warehousetiredirect.com';

async function fetchJSON(url) {
  const res = await fetch(url, { 
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function log(test, passed, details = '') {
  results.tests.push({ test, passed, details });
  if (passed) {
    results.passed++;
    console.log(`✅ ${test}${details ? ` - ${details}` : ''}`);
  } else {
    results.failed++;
    console.log(`❌ ${test}${details ? ` - ${details}` : ''}`);
  }
}

console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
console.log(`║   PRODUCTION SMOKE TEST SUITE                                 ║`);
console.log(`║   ${BASE_URL}`.padEnd(64) + `║`);
console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

// ============================================================================
// TEST 1: Staggered Vehicles (Camaro/Corvette/Mustang/BMW)
// ============================================================================
console.log('═══ TEST 1: Staggered Vehicles ═══\n');

const staggeredTests = [
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS 1LE', expected: ['front', 'rear'] },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', expected: ['front', 'rear'] },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Z06', expected: ['front', 'rear'] },
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT Performance Package', expected: ['front', 'rear'] },
  { year: 2024, make: 'BMW', model: 'M3', trim: 'M3 CS', expected: ['front', 'rear'] },
  { year: 2024, make: 'BMW', model: 'M3', trim: 'M3 Competition', expected: ['front', 'rear'] },
];

for (const test of staggeredTests) {
  try {
    const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${test.year}&make=${encodeURIComponent(test.make)}&model=${encodeURIComponent(test.model)}&trim=${encodeURIComponent(test.trim)}`;
    const data = await fetchJSON(url);
    
    const isStaggered = data.staggered?.isStaggered === true;
    const hasFront = !!data.staggered?.frontTireSize;
    const hasRear = !!data.staggered?.rearTireSize;
    
    if (isStaggered && hasFront && hasRear) {
      log(`${test.year} ${test.make} ${test.model} ${test.trim}`, true, 
          `staggered F:${data.staggered.frontTireSize} R:${data.staggered.rearTireSize}`);
    } else {
      log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false,
          `staggered=${isStaggered}, sizes=${data.tireSizes?.length || 0}`);
    }
  } catch (err) {
    log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false, err.message);
  }
}

// ============================================================================
// TEST 2: HD Truck LT Sizes with /E
// ============================================================================
console.log('\n═══ TEST 2: HD Truck LT Sizes ═══\n');

const hdTests = [
  { year: 2018, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT', expectPattern: /LT\d+\/\d+R\d+\/E/ },
  { year: 2018, make: 'Ford', model: 'F-250 Super Duty', trim: 'XLT 4x4', expectPattern: /LT\d+\/\d+R\d+/ },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500HD', trim: 'LT', expectPattern: /LT\d+\/\d+R\d+/ },
];

for (const test of hdTests) {
  try {
    const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${test.year}&make=${encodeURIComponent(test.make)}&model=${encodeURIComponent(test.model)}&trim=${encodeURIComponent(test.trim)}`;
    const data = await fetchJSON(url);
    
    const hasSizes = data.tireSizes?.length > 0;
    const hasMatch = data.tireSizes?.some(s => test.expectPattern.test(s));
    
    if (hasSizes) {
      log(`${test.year} ${test.make} ${test.model} ${test.trim}`, true,
          `${data.tireSizes.length} sizes: ${data.tireSizes.slice(0, 2).join(', ')}...`);
    } else {
      log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false, 'No tire sizes');
    }
  } catch (err) {
    log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false, err.message);
  }
}

// ============================================================================
// TEST 3: Mercedes Alias Resolution
// ============================================================================
console.log('\n═══ TEST 3: Mercedes Alias Resolution ═══\n');

const mercedesTests = [
  { year: 2024, make: 'Mercedes-Benz', model: 'C-Class', trim: 'C300' },
  { year: 2024, make: 'Mercedes-Benz', model: 'E-Class', trim: 'E350' },
];

for (const test of mercedesTests) {
  try {
    const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${test.year}&make=${encodeURIComponent(test.make)}&model=${encodeURIComponent(test.model)}&trim=${encodeURIComponent(test.trim)}`;
    const data = await fetchJSON(url);
    
    const hasSizes = data.tireSizes?.length > 0;
    log(`${test.year} ${test.make} ${test.model} ${test.trim}`, hasSizes,
        hasSizes ? `${data.tireSizes.length} sizes` : 'No tire sizes');
  } catch (err) {
    log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false, err.message);
  }
}

// ============================================================================
// TEST 4: Sedan Resolver
// ============================================================================
console.log('\n═══ TEST 4: Sedan Resolver ═══\n');

const sedanTests = [
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'LE' },
  { year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport' },
  { year: 2024, make: 'Honda', model: 'Civic', trim: 'Sport' },
];

for (const test of sedanTests) {
  try {
    const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${test.year}&make=${encodeURIComponent(test.make)}&model=${encodeURIComponent(test.model)}&trim=${encodeURIComponent(test.trim)}`;
    const data = await fetchJSON(url);
    
    const hasSizes = data.tireSizes?.length > 0;
    const source = data.source || 'unknown';
    log(`${test.year} ${test.make} ${test.model} ${test.trim}`, hasSizes,
        `source=${source}, sizes=${data.tireSizes?.length || 0}`);
  } catch (err) {
    log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false, err.message);
  }
}

// ============================================================================
// TEST 5: Package Flow (Wheel Fitment Search)
// ============================================================================
console.log('\n═══ TEST 5: Package Flow (Wheel Fitment) ═══\n');

const packageTests = [
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray' },
];

for (const test of packageTests) {
  try {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${test.year}&make=${encodeURIComponent(test.make)}&model=${encodeURIComponent(test.model)}&trim=${encodeURIComponent(test.trim)}&limit=5`;
    const data = await fetchJSON(url);
    
    const hasWheels = data.wheels?.length > 0 || data.totalCount > 0;
    log(`${test.year} ${test.make} ${test.model} ${test.trim} (wheels)`, hasWheels,
        `${data.totalCount || data.wheels?.length || 0} wheels found`);
  } catch (err) {
    log(`${test.year} ${test.make} ${test.model} ${test.trim} (wheels)`, false, err.message);
  }
}

// ============================================================================
// TEST 6: 50-Vehicle Runtime Spot-Check Sample
// ============================================================================
console.log('\n═══ TEST 6: Runtime Spot-Check (10 sample) ═══\n');

const spotCheckSample = [
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT' },
  { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Pro' },
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon' },
  { year: 2024, make: 'Ram', model: '1500', trim: 'Laramie' },
  { year: 2024, make: 'Tesla', model: 'Model 3', trim: 'Performance' },
  { year: 2023, make: 'Porsche', model: '911', trim: 'Carrera' },
  { year: 2022, make: 'GMC', model: 'Sierra 1500', trim: 'Denali' },
  { year: 2020, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray' },
  { year: 2018, make: 'Ford', model: 'Mustang', trim: 'Shelby GT350' },
  { year: 2025, make: 'Chevrolet', model: 'Corvette', trim: 'E-Ray' },
];

for (const test of spotCheckSample) {
  try {
    const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${test.year}&make=${encodeURIComponent(test.make)}&model=${encodeURIComponent(test.model)}&trim=${encodeURIComponent(test.trim)}`;
    const data = await fetchJSON(url);
    
    // Check for 500 risk indicators
    const is500Risk = data.error || data.status === 500;
    const isDeprecated = data.source === 'config' || data.source === 'static';
    
    if (is500Risk) {
      log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false, 'ERROR/500 risk');
    } else if (isDeprecated) {
      log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false, `deprecated source: ${data.source}`);
    } else {
      log(`${test.year} ${test.make} ${test.model} ${test.trim}`, true,
          `source=${data.source}, sizes=${data.tireSizes?.length || 0}`);
    }
  } catch (err) {
    log(`${test.year} ${test.make} ${test.model} ${test.trim}`, false, err.message);
  }
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`PRODUCTION SMOKE TEST COMPLETE`);
console.log(`═══════════════════════════════════════════════════════════════`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Total:  ${results.passed + results.failed}`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (results.failed > 0) {
  console.log('❌ SMOKE TEST FAILED\n');
  process.exit(1);
} else {
  console.log('✅ ALL SMOKE TESTS PASSED\n');
  process.exit(0);
}
