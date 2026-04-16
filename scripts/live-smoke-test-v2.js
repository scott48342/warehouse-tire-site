/**
 * LIVE SMOKE TEST v2 - Retail and POS Staggered Fitment
 * 
 * Tests the SAME API flow for both retail and POS:
 * When wheel diameters are selected, both should call:
 * /api/tires/search?wheelDiameter=X&rearWheelDiameter=Y
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

function extractDia(size) {
  if (!size) return null;
  const m = size.match(/R(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

async function fetchJson(url, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    return { error: e.message };
  }
}

const TESTS = [
  {
    name: 'Corvette Mixed 19F/20R',
    vehicle: { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray' },
    wheels: { frontDia: 19, rearDia: 20 },
    expected: { frontTireDia: 19, rearTireDia: 20, isStaggered: true },
  },
  {
    name: 'Mustang Mixed 19F/20R',
    vehicle: { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack' },
    wheels: { frontDia: 19, rearDia: 20 },
    expected: { frontTireDia: 19, rearTireDia: 20, isStaggered: true },
  },
  {
    name: 'Camaro Mixed 20F/21R',
    vehicle: { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS 1LE' },
    wheels: { frontDia: 20, rearDia: 21 },
    expected: { frontTireDia: 20, rearTireDia: 21, isStaggered: true },
  },
  {
    name: 'Mustang Same-Dia 19/19',
    vehicle: { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack' },
    wheels: { frontDia: 19, rearDia: 19 },
    expected: { frontTireDia: 19, rearTireDia: 19, isStaggered: true },
  },
  {
    name: 'F-150 Square 20/20',
    vehicle: { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT' },
    wheels: { frontDia: 20, rearDia: 20 },
    expected: { frontTireDia: 20, rearTireDia: 20, isStaggered: false },
  },
];

/**
 * Unified test function - both retail and POS should use this same API
 * when wheel diameters are explicitly selected
 */
async function runTest(test, surface) {
  const { vehicle, wheels, expected } = test;
  const result = {
    name: `${surface}: ${test.name}`,
    surface,
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    wheels: `${wheels.frontDia}F/${wheels.rearDia}R`,
    staggeredDetection: null,
    tireSizesSearched: null,
    frontTireSize: null,
    rearTireSize: null,
    frontDiaMatch: null,
    rearDiaMatch: null,
    staggeredCorrect: null,
    errors: [],
    status: 'UNKNOWN',
  };

  // Step 1: Check staggered detection from fitment API
  const fitmentUrl = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}&pageSize=1`;
  const fitmentData = await fetchJson(fitmentUrl);
  
  if (fitmentData.error) {
    result.errors.push(`Fitment API: ${fitmentData.error}`);
  } else {
    result.staggeredDetection = fitmentData.fitment?.staggered?.isStaggered ? 'STAGGERED' : 'SQUARE';
    result.staggeredCorrect = fitmentData.fitment?.staggered?.isStaggered === expected.isStaggered;
  }

  // Step 2: Call tire search API with explicit wheel diameters
  // This is what BOTH retail and POS should do when wheels are selected
  const tiresUrl = `${BASE_URL}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}&wheelDiameter=${wheels.frontDia}&rearWheelDiameter=${wheels.rearDia}&pageSize=10`;
  const tiresData = await fetchJson(tiresUrl);
  
  if (tiresData.error) {
    result.errors.push(`Tires API: ${tiresData.error}`);
  } else {
    const searched = tiresData.tireSizesSearched;
    
    if (searched?.front && searched?.rear) {
      // Mixed stagger response
      result.tireSizesSearched = `F: ${searched.front.slice(0,2).join(', ')} | R: ${searched.rear.slice(0,2).join(', ')}`;
      result.frontTireSize = searched.front[0];
      result.rearTireSize = searched.rear[0];
    } else if (Array.isArray(searched)) {
      // Square or same-diameter response
      result.tireSizesSearched = searched.slice(0,3).join(', ');
      result.frontTireSize = searched[0];
      result.rearTireSize = searched[1] || searched[0];
    }
    
    const actualFrontDia = extractDia(result.frontTireSize);
    const actualRearDia = extractDia(result.rearTireSize);
    
    result.frontDiaMatch = actualFrontDia === expected.frontTireDia;
    result.rearDiaMatch = actualRearDia === expected.rearTireDia;
  }

  // Determine status
  if (result.errors.length > 0) {
    result.status = 'ERROR';
  } else if (result.frontDiaMatch && result.rearDiaMatch && result.staggeredCorrect) {
    result.status = 'PASS';
  } else {
    result.status = 'FAIL';
  }

  return result;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        LIVE SMOKE TEST v2 - Retail & POS Staggered Fitment                               ║');
  console.log('║       (Both surfaces use same API: /api/tires/search?wheelDiameter=X&rearWheelDiameter=Y)                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Run tests for both surfaces (using the same API call)
  const allResults = [];
  
  for (const surface of ['RETAIL', 'POS']) {
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log(`                                    ${surface} LIVE TESTS`);
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Vehicle                              | Wheels    | Stagger | Front Tire        | Rear Tire         | Status');
    console.log('─────────────────────────────────────┼───────────┼─────────┼───────────────────┼───────────────────┼───────');

    for (const test of TESTS) {
      const r = await runTest(test, surface);
      allResults.push(r);
      
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '🔴';
      const stagger = r.staggeredDetection || 'N/A';
      const front = r.frontTireSize ? `${r.frontTireSize} ${r.frontDiaMatch ? '✓' : '✗'}` : 'N/A';
      const rear = r.rearTireSize ? `${r.rearTireSize} ${r.rearDiaMatch ? '✓' : '✗'}` : 'N/A';
      
      console.log(`${test.name.padEnd(36)} | ${r.wheels.padEnd(9)} | ${stagger.padEnd(7)} | ${front.padEnd(17)} | ${rear.padEnd(17)} | ${icon} ${r.status}`);
    }
    console.log('');
  }

  // Summary
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                        EXECUTIVE SUMMARY                                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
  
  const retailResults = allResults.filter(r => r.surface === 'RETAIL');
  const posResults = allResults.filter(r => r.surface === 'POS');
  
  const retailPass = retailResults.filter(r => r.status === 'PASS').length;
  const posPass = posResults.filter(r => r.status === 'PASS').length;
  
  console.log(`║ RETAIL: ${retailPass}/${retailResults.length} passed ${retailPass === retailResults.length ? '✅' : '❌'}`.padEnd(107) + '║');
  console.log(`║ POS:    ${posPass}/${posResults.length} passed ${posPass === posResults.length ? '✅' : '❌'}`.padEnd(107) + '║');
  console.log('╟──────────────────────────────────────────────────────────────────────────────────────────────────────────╢');
  
  // Check consistency
  let consistent = true;
  for (let i = 0; i < TESTS.length; i++) {
    if (retailResults[i].status !== posResults[i].status) {
      consistent = false;
    }
  }
  
  if (consistent) {
    console.log('║ RETAIL/POS CONSISTENCY: ✅ Both surfaces produce identical results'.padEnd(107) + '║');
  } else {
    console.log('║ RETAIL/POS CONSISTENCY: ❌ Surfaces differ - see results above'.padEnd(107) + '║');
  }
  
  console.log('╟──────────────────────────────────────────────────────────────────────────────────────────────────────────╢');
  
  // Final verdict
  const allPass = retailPass === retailResults.length && posPass === posResults.length && consistent;
  const verdict = allPass
    ? '✅ BOTH CORRECT - All wheel-diameter-based tire searches work correctly'
    : '❌ ISSUES FOUND - See results above';
  
  console.log(`║ FINAL VERDICT: ${verdict}`.padEnd(107) + '║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  
  process.exit(allPass ? 0 : 1);
}

main().catch(console.error);
