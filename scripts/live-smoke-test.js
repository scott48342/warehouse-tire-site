/**
 * LIVE SMOKE TEST - Retail and POS Staggered Fitment
 * 
 * Tests the actual API endpoints that retail and POS pages call
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

function extractDia(size) {
  if (!size) return null;
  const m = size.match(/R(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function extractWidth(size) {
  if (!size) return null;
  const m = size.match(/^P?(\d{3})\//);
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

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

const RETAIL_TESTS = [
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

// POS tests use the same vehicles but call different endpoints
const POS_TESTS = RETAIL_TESTS.map(t => ({ ...t, name: `POS: ${t.name}` }));

// ═══════════════════════════════════════════════════════════════════════════
// RETAIL TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

async function runRetailTest(test) {
  const { vehicle, wheels, expected } = test;
  const result = {
    name: test.name,
    surface: 'RETAIL',
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    wheels: `${wheels.frontDia}F/${wheels.rearDia}R`,
    fitmentDetection: null,
    tireSizesSearched: null,
    frontTireSize: null,
    rearTireSize: null,
    frontDiaMatch: null,
    rearDiaMatch: null,
    staggeredCorrect: null,
    errors: [],
    status: 'UNKNOWN',
  };

  // Step 1: Check fitment detection
  const fitmentUrl = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}&pageSize=1`;
  const fitmentData = await fetchJson(fitmentUrl);
  
  if (fitmentData.error) {
    result.errors.push(`Fitment API: ${fitmentData.error}`);
  } else {
    result.fitmentDetection = fitmentData.fitment?.staggered?.isStaggered ? 'STAGGERED' : 'SQUARE';
    result.staggeredCorrect = fitmentData.fitment?.staggered?.isStaggered === expected.isStaggered;
  }

  // Step 2: Check tire search with wheel diameters
  const tiresUrl = `${BASE_URL}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}&wheelDiameter=${wheels.frontDia}&rearWheelDiameter=${wheels.rearDia}&pageSize=10`;
  const tiresData = await fetchJson(tiresUrl);
  
  if (tiresData.error) {
    result.errors.push(`Tires API: ${tiresData.error}`);
  } else {
    const searched = tiresData.tireSizesSearched;
    
    if (searched?.front && searched?.rear) {
      // Mixed stagger response
      result.tireSizesSearched = `F: ${searched.front.join(', ')} | R: ${searched.rear.join(', ')}`;
      result.frontTireSize = searched.front[0];
      result.rearTireSize = searched.rear[0];
    } else if (Array.isArray(searched)) {
      // Square or same-diameter response
      result.tireSizesSearched = searched.join(', ');
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

// ═══════════════════════════════════════════════════════════════════════════
// POS TEST RUNNER (uses same APIs but simulates POS flow)
// ═══════════════════════════════════════════════════════════════════════════

async function runPOSTest(test) {
  const { vehicle, wheels, expected } = test;
  const result = {
    name: test.name,
    surface: 'POS',
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    wheels: `${wheels.frontDia}F/${wheels.rearDia}R`,
    fitmentDetection: null,
    tireSizesSearched: null,
    frontTireSize: null,
    rearTireSize: null,
    frontDiaMatch: null,
    rearDiaMatch: null,
    staggeredCorrect: null,
    errors: [],
    status: 'UNKNOWN',
  };

  // POS uses the same fitment-search API
  const fitmentUrl = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}&pageSize=1`;
  const fitmentData = await fetchJson(fitmentUrl);
  
  if (fitmentData.error) {
    result.errors.push(`Fitment API: ${fitmentData.error}`);
  } else {
    result.fitmentDetection = fitmentData.fitment?.staggered?.isStaggered ? 'STAGGERED' : 'SQUARE';
    result.staggeredCorrect = fitmentData.fitment?.staggered?.isStaggered === expected.isStaggered;
    
    // POS checks staggeredInfo from fitment response
    const staggeredInfo = fitmentData.fitment?.staggered;
    if (staggeredInfo?.frontSpec?.tireSize && staggeredInfo?.rearSpec?.tireSize) {
      result.frontTireSize = staggeredInfo.frontSpec.tireSize;
      result.rearTireSize = staggeredInfo.rearSpec.tireSize;
    }
  }

  // POS calls staggered-search when staggered is detected
  if (result.fitmentDetection === 'STAGGERED' && result.frontTireSize && result.rearTireSize) {
    // POS would call staggered-search with these tire sizes
    const staggeredUrl = `${BASE_URL}/api/tires/staggered-search?frontSize=${encodeURIComponent(result.frontTireSize)}&rearSize=${encodeURIComponent(result.rearTireSize)}&minQty=2`;
    const staggeredData = await fetchJson(staggeredUrl);
    
    if (staggeredData.error) {
      result.errors.push(`Staggered search: ${staggeredData.error}`);
    } else {
      result.tireSizesSearched = `F: ${result.frontTireSize} | R: ${result.rearTireSize}`;
    }
  } else {
    // POS calls regular tire search for non-staggered
    const tiresUrl = `${BASE_URL}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}&wheelDiameter=${wheels.frontDia}&pageSize=10`;
    const tiresData = await fetchJson(tiresUrl);
    
    if (tiresData.error) {
      result.errors.push(`Tires API: ${tiresData.error}`);
    } else {
      const searched = tiresData.tireSizesSearched;
      if (Array.isArray(searched)) {
        result.tireSizesSearched = searched.join(', ');
        result.frontTireSize = searched[0];
        result.rearTireSize = searched[0];
      }
    }
  }

  const actualFrontDia = extractDia(result.frontTireSize);
  const actualRearDia = extractDia(result.rearTireSize);
  
  result.frontDiaMatch = actualFrontDia === expected.frontTireDia;
  result.rearDiaMatch = actualRearDia === expected.rearTireDia;

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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           LIVE SMOKE TEST - Retail & POS Staggered Fitment                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Run retail tests
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('                                    RETAIL LIVE TESTS');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Vehicle                              | Wheels    | Stagger | Front Tire        | Rear Tire         | Status');
  console.log('─────────────────────────────────────┼───────────┼─────────┼───────────────────┼───────────────────┼───────');

  const retailResults = [];
  for (const test of RETAIL_TESTS) {
    const r = await runRetailTest(test);
    retailResults.push(r);
    
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '🔴';
    const stagger = r.fitmentDetection || 'N/A';
    const front = r.frontTireSize ? `${r.frontTireSize} ${r.frontDiaMatch ? '✓' : '✗'}` : 'N/A';
    const rear = r.rearTireSize ? `${r.rearTireSize} ${r.rearDiaMatch ? '✓' : '✗'}` : 'N/A';
    
    console.log(`${r.name.padEnd(36)} | ${r.wheels.padEnd(9)} | ${stagger.padEnd(7)} | ${front.padEnd(17)} | ${rear.padEnd(17)} | ${icon} ${r.status}`);
    
    if (r.status !== 'PASS') {
      if (r.errors.length > 0) {
        console.log(`  └─ Errors: ${r.errors.join(', ')}`);
      }
    }
  }

  // Run POS tests
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('                                      POS LIVE TESTS');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Vehicle                              | Wheels    | Stagger | Front Tire        | Rear Tire         | Status');
  console.log('─────────────────────────────────────┼───────────┼─────────┼───────────────────┼───────────────────┼───────');

  const posResults = [];
  for (const test of POS_TESTS) {
    const r = await runPOSTest(test);
    posResults.push(r);
    
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '🔴';
    const stagger = r.fitmentDetection || 'N/A';
    const front = r.frontTireSize ? `${r.frontTireSize} ${r.frontDiaMatch ? '✓' : '✗'}` : 'N/A';
    const rear = r.rearTireSize ? `${r.rearTireSize} ${r.rearDiaMatch ? '✓' : '✗'}` : 'N/A';
    
    console.log(`${r.name.padEnd(36)} | ${r.wheels.padEnd(9)} | ${stagger.padEnd(7)} | ${front.padEnd(17)} | ${rear.padEnd(17)} | ${icon} ${r.status}`);
    
    if (r.status !== 'PASS') {
      if (r.errors.length > 0) {
        console.log(`  └─ Errors: ${r.errors.join(', ')}`);
      }
    }
  }

  // Summary
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                        EXECUTIVE SUMMARY                                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
  
  const retailPass = retailResults.filter(r => r.status === 'PASS').length;
  const retailTotal = retailResults.length;
  const posPass = posResults.filter(r => r.status === 'PASS').length;
  const posTotal = posResults.length;
  
  console.log(`║ RETAIL: ${retailPass}/${retailTotal} passed ${retailPass === retailTotal ? '✅' : '❌'}`.padEnd(107) + '║');
  console.log(`║ POS:    ${posPass}/${posTotal} passed ${posPass === posTotal ? '✅' : '❌'}`.padEnd(107) + '║');
  console.log('╟──────────────────────────────────────────────────────────────────────────────────────────────────────────╢');
  
  // Differences
  const differences = [];
  for (let i = 0; i < retailResults.length; i++) {
    const retail = retailResults[i];
    const pos = posResults[i];
    if (retail.status !== pos.status) {
      differences.push({
        test: RETAIL_TESTS[i].name,
        retail: retail.status,
        pos: pos.status,
      });
    }
  }
  
  if (differences.length === 0) {
    console.log('║ RETAIL/POS CONSISTENCY: ✅ Both surfaces behave identically'.padEnd(107) + '║');
  } else {
    console.log('║ RETAIL/POS DIFFERENCES:'.padEnd(107) + '║');
    for (const d of differences) {
      console.log(`║   - ${d.test}: Retail=${d.retail}, POS=${d.pos}`.padEnd(107) + '║');
    }
  }
  
  console.log('╟──────────────────────────────────────────────────────────────────────────────────────────────────────────╢');
  
  // Final verdict
  let verdict;
  if (retailPass === retailTotal && posPass === posTotal) {
    verdict = '✅ BOTH CORRECT - No further changes needed';
  } else if (retailPass === retailTotal && posPass < posTotal) {
    verdict = '⚠️ RETAIL CORRECT, POS NEEDS FOLLOW-UP';
  } else if (retailPass < retailTotal && posPass === posTotal) {
    verdict = '⚠️ POS CORRECT, RETAIL NEEDS FOLLOW-UP';
  } else {
    verdict = '❌ SHARED REGRESSION STILL EXISTS';
  }
  
  console.log(`║ FINAL VERDICT: ${verdict}`.padEnd(107) + '║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  
  // Exit code
  const allPass = retailPass === retailTotal && posPass === posTotal;
  process.exit(allPass ? 0 : 1);
}

main().catch(console.error);
