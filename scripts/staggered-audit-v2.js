/**
 * Staggered Fitment Audit v2
 * Tests tire sizing via actual page loads (simulates real user flow)
 * 
 * Flow per vehicle:
 * 1. Hit fitment-search to get staggered detection + OEM specs
 * 2. Hit tire-sizes API to get OEM tire sizes
 * 3. Test tire page with various wheel diameter selections
 * 4. Verify tire sizes searched match the selected wheel diameters
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const TEST_VEHICLES = [
  // Known staggered vehicles (mixed diameter OEM)
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', name: 'C8 Corvette Stingray', expectStaggered: true },
  { year: 2019, make: 'Chevrolet', model: 'Corvette', trim: 'Grand Sport', name: 'C7 Corvette Grand Sport', expectStaggered: true },
  // Known staggered vehicles (same diameter, different widths)
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack', name: 'Mustang GT Perf Pack', expectStaggered: true },
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'Dark Horse', name: 'Mustang Dark Horse', expectStaggered: true },
  // BMW M cars
  { year: 2024, make: 'BMW', model: 'M3', trim: '', name: 'BMW M3', expectStaggered: true },
  { year: 2024, make: 'BMW', model: 'M4', trim: '', name: 'BMW M4', expectStaggered: true },
  // Muscle cars
  { year: 2023, make: 'Dodge', model: 'Charger', trim: 'Scat Pack Widebody', name: 'Charger Scat Pack WB', expectStaggered: true },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS 1LE', name: 'Camaro SS 1LE', expectStaggered: true },
  // Standard vehicles (should NOT be staggered)
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', name: 'F-150 XLT', expectStaggered: false },
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'XSE', name: 'Camry XSE', expectStaggered: false },
];

// Wheel diameter scenarios to test for staggered vehicles
const STAGGERED_SCENARIOS = [
  { name: 'OEM (from fitment)', frontDia: null, rearDia: null, useOem: true },
  { name: 'Mixed 19F/20R', frontDia: 19, rearDia: 20, useOem: false },
  { name: 'Same 20/20', frontDia: 20, rearDia: 20, useOem: false },
  { name: 'Mixed 20F/21R', frontDia: 20, rearDia: 21, useOem: false },
];

// Wheel diameter scenarios for square vehicles
const SQUARE_SCENARIOS = [
  { name: 'OEM', dia: null, useOem: true },
  { name: '19"', dia: 19, useOem: false },
  { name: '20"', dia: 20, useOem: false },
];

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

function extractDiameter(tireSize) {
  if (!tireSize) return null;
  const match = tireSize.match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

async function getFitmentInfo(vehicle) {
  const url = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}&pageSize=1`;
  const data = await fetchJson(url);
  
  return {
    isStaggered: data.fitment?.staggered?.isStaggered || false,
    reason: data.fitment?.staggered?.reason || null,
    frontSpec: data.fitment?.staggered?.frontSpec || null,
    rearSpec: data.fitment?.staggered?.rearSpec || null,
    boltPattern: data.fitment?.dbProfile?.boltPattern || null,
    error: data.error || null,
  };
}

async function getTireSizes(vehicle) {
  const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}`;
  const data = await fetchJson(url);
  
  return {
    tireSizes: data.tireSizes || data.sizes || [],
    searchableSizes: data.searchableSizes || [],
    wheelDiameters: data.wheelDiameters?.available || [],
    source: data.source,
    error: data.error,
  };
}

/**
 * Test a specific wheel configuration and check resulting tire sizes
 */
async function testTirePageConfig(vehicle, wheelConfig) {
  let url = `${BASE_URL}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
  if (vehicle.trim) url += `&modification=${encodeURIComponent(vehicle.trim)}`;
  
  if (wheelConfig.frontDia && wheelConfig.rearDia) {
    // Staggered wheel selection
    url += `&wheelDiameter=${wheelConfig.frontDia}&rearWheelDiameter=${wheelConfig.rearDia}`;
  } else if (wheelConfig.dia) {
    // Square wheel selection
    url += `&wheelDiameter=${wheelConfig.dia}`;
  }
  
  url += '&pageSize=1&includeDebug=true';
  
  const data = await fetchJson(url);
  
  // The search API may return different response shapes
  return {
    searchedSize: data.searchedSize || null,
    searchedSizes: data.searchedSizes || null,
    sizeResolution: data.sizeResolution || null,
    tireSizes: data.tireSizes || [],
    total: data.total || 0,
    debug: data.debug || null,
    error: data.error,
    rawResponse: data,
  };
}

/**
 * Calculate expected tire size from wheel dimensions (mirrors page.tsx logic)
 */
function calculateExpectedTireSize(wheelDia, wheelWidth = 9) {
  const STANDARD_TIRE_WIDTHS = [195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315, 325, 335, 345];
  const stretchMm = wheelDia >= 22 ? 45 : wheelDia >= 20 ? 30 : 25;
  const targetMm = wheelWidth * 25.4 + stretchMm;
  const tireWidth = STANDARD_TIRE_WIDTHS.reduce((prev, curr) => 
    Math.abs(curr - targetMm) < Math.abs(prev - targetMm) ? curr : prev
  );
  const aspect = tireWidth >= 285 ? 30 : 35;
  return `${tireWidth}/${aspect}R${wheelDia}`;
}

async function auditVehicle(vehicle) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 ${vehicle.name}`);
  console.log(`   ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || '(base)'}`);
  console.log(`${'═'.repeat(70)}`);
  
  const result = {
    vehicle: vehicle.name,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    expectStaggered: vehicle.expectStaggered,
    fitment: null,
    tireSizes: null,
    tests: [],
    issues: [],
    status: 'UNKNOWN',
  };
  
  // 1. Get fitment info
  console.log('  ├─ Fetching fitment info...');
  const fitment = await getFitmentInfo(vehicle);
  result.fitment = fitment;
  
  if (fitment.error) {
    console.log(`  │  ❌ ERROR: ${fitment.error}`);
    result.issues.push(`Fitment API error: ${fitment.error}`);
  } else {
    const staggeredIcon = fitment.isStaggered ? '🔀' : '⬜';
    console.log(`  │  ${staggeredIcon} Staggered: ${fitment.isStaggered} ${fitment.reason ? `(${fitment.reason})` : ''}`);
    
    if (fitment.isStaggered) {
      console.log(`  │  Front: ${fitment.frontSpec?.diameter}"×${fitment.frontSpec?.width}" → ${fitment.frontSpec?.tireSize || 'N/A'}`);
      console.log(`  │  Rear:  ${fitment.rearSpec?.diameter}"×${fitment.rearSpec?.width}" → ${fitment.rearSpec?.tireSize || 'N/A'}`);
      
      if (!fitment.frontSpec?.tireSize && fitment.frontSpec?.diameter) {
        result.issues.push('Front tireSize is null in staggered spec');
      }
      if (!fitment.rearSpec?.tireSize && fitment.rearSpec?.diameter) {
        result.issues.push('Rear tireSize is null in staggered spec');
      }
    }
    
    // Check expectation match
    if (vehicle.expectStaggered !== fitment.isStaggered) {
      result.issues.push(`Staggered mismatch: expected ${vehicle.expectStaggered}, got ${fitment.isStaggered}`);
    }
  }
  
  // 2. Get OEM tire sizes
  console.log('  ├─ Fetching OEM tire sizes...');
  const tireSizes = await getTireSizes(vehicle);
  result.tireSizes = tireSizes;
  
  if (tireSizes.error) {
    console.log(`  │  ❌ ERROR: ${tireSizes.error}`);
    result.issues.push(`Tire sizes API error: ${tireSizes.error}`);
  } else {
    console.log(`  │  OEM sizes: ${tireSizes.tireSizes.slice(0, 4).join(', ')}${tireSizes.tireSizes.length > 4 ? '...' : ''}`);
    console.log(`  │  Wheel diameters: ${tireSizes.wheelDiameters.join(', ') || 'N/A'}`);
  }
  
  // 3. Test wheel configurations
  const scenarios = fitment.isStaggered ? STAGGERED_SCENARIOS : SQUARE_SCENARIOS;
  console.log('  └─ Testing wheel configurations:');
  
  for (const scenario of scenarios) {
    let testConfig = {};
    let expectedFrontDia, expectedRearDia;
    
    if (scenario.useOem) {
      // Use OEM wheel sizes from fitment
      if (fitment.isStaggered && fitment.frontSpec?.diameter && fitment.rearSpec?.diameter) {
        testConfig.frontDia = fitment.frontSpec.diameter;
        testConfig.rearDia = fitment.rearSpec.diameter;
        expectedFrontDia = fitment.frontSpec.diameter;
        expectedRearDia = fitment.rearSpec.diameter;
      } else {
        // Use first available wheel diameter or default
        const defaultDia = tireSizes.wheelDiameters[0] || 18;
        testConfig.dia = defaultDia;
        expectedFrontDia = defaultDia;
        expectedRearDia = defaultDia;
      }
    } else if (scenario.frontDia && scenario.rearDia) {
      testConfig.frontDia = scenario.frontDia;
      testConfig.rearDia = scenario.rearDia;
      expectedFrontDia = scenario.frontDia;
      expectedRearDia = scenario.rearDia;
    } else if (scenario.dia) {
      testConfig.dia = scenario.dia;
      expectedFrontDia = scenario.dia;
      expectedRearDia = scenario.dia;
    }
    
    const testResult = {
      scenario: scenario.name,
      config: testConfig,
      expectedFrontDia,
      expectedRearDia,
      actualFrontSize: null,
      actualRearSize: null,
      actualFrontDia: null,
      actualRearDia: null,
      frontMatch: null,
      rearMatch: null,
      status: 'UNKNOWN',
    };
    
    const pageResult = await testTirePageConfig(vehicle, testConfig);
    
    // Extract actual tire sizes from response
    if (pageResult.error) {
      testResult.status = 'ERROR';
      testResult.errorMsg = pageResult.error;
    } else {
      // The API returns:
      // - tireSizesSearched: Array of sizes that were searched (e.g., ['285/30R20', '305/30R20'])
      // - results: Array of tire products found
      const sizesSearched = pageResult.rawResponse?.tireSizesSearched || [];
      
      if (sizesSearched.length > 0) {
        // For staggered, first size is typically front (smaller), second is rear (larger)
        testResult.actualFrontSize = sizesSearched[0];
        testResult.actualRearSize = sizesSearched.length > 1 ? sizesSearched[1] : sizesSearched[0];
      } else if (pageResult.rawResponse?.results?.length > 0) {
        // Fall back to first result's size
        const firstSize = pageResult.rawResponse.results[0]?.size;
        testResult.actualFrontSize = firstSize;
        testResult.actualRearSize = firstSize;
      }
      
      // Extract diameters
      testResult.actualFrontDia = extractDiameter(testResult.actualFrontSize);
      testResult.actualRearDia = extractDiameter(testResult.actualRearSize);
      
      // Validate diameter matches
      testResult.frontMatch = testResult.actualFrontDia === expectedFrontDia;
      testResult.rearMatch = testResult.actualRearDia === expectedRearDia;
      
      // Determine status
      if (testResult.actualFrontSize === null && testResult.actualRearSize === null) {
        testResult.status = 'NO_DATA';
      } else if (testResult.frontMatch === false || testResult.rearMatch === false) {
        testResult.status = 'FAIL';
      } else if (testResult.frontMatch === true && testResult.rearMatch !== false) {
        testResult.status = 'PASS';
      } else {
        testResult.status = 'PARTIAL';
      }
    }
    
    result.tests.push(testResult);
    
    // Display result
    const icon = testResult.status === 'PASS' ? '✅' : 
                 testResult.status === 'FAIL' ? '❌' : 
                 testResult.status === 'NO_DATA' ? '⚠️' :
                 testResult.status === 'ERROR' ? '🔴' : '❓';
    console.log(`     ${icon} ${scenario.name.padEnd(15)} | Wheels: ${testConfig.frontDia || testConfig.dia}/${testConfig.rearDia || testConfig.dia} → Tires: ${testResult.actualFrontSize || 'N/A'} / ${testResult.actualRearSize || 'N/A'} [${testResult.status}]`);
    
    if (testResult.status === 'FAIL') {
      console.log(`        ⚠️  Expected R${expectedFrontDia}/R${expectedRearDia}, got R${testResult.actualFrontDia}/R${testResult.actualRearDia}`);
      result.issues.push(`${scenario.name}: Tire diameter mismatch (expected ${expectedFrontDia}/${expectedRearDia}, got ${testResult.actualFrontDia}/${testResult.actualRearDia})`);
    }
  }
  
  // Determine overall status
  const testStatuses = result.tests.map(t => t.status);
  if (testStatuses.every(s => s === 'PASS')) {
    result.status = 'PASS';
  } else if (testStatuses.some(s => s === 'FAIL')) {
    result.status = 'FAIL';
  } else if (testStatuses.some(s => s === 'PARTIAL' || s === 'NO_DATA')) {
    result.status = 'PARTIAL';
  } else {
    result.status = 'ERROR';
  }
  
  return result;
}

async function runAudit() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║          STAGGERED FITMENT AUDIT v2 - Retail Site                    ║');
  console.log('║  Testing tire sizing follows wheel diameter selection                ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Base URL: ${BASE_URL.padEnd(55)}║`);
  console.log(`║ Vehicles: ${TEST_VEHICLES.length.toString().padEnd(55)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const allResults = [];
  
  for (const vehicle of TEST_VEHICLES) {
    const result = await auditVehicle(vehicle);
    allResults.push(result);
    
    // Small delay between vehicles
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Final Summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                       AUDIT SUMMARY                                                      ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Vehicle                        │ Staggered  │ Expected │ Tests      │ Status  │ Issues                   ║');
  console.log('╟────────────────────────────────┼────────────┼──────────┼────────────┼─────────┼──────────────────────────╢');
  
  for (const r of allResults) {
    const stag = r.fitment?.isStaggered ? 'YES' : 'NO';
    const exp = r.expectStaggered ? 'YES' : 'NO';
    const passes = r.tests.filter(t => t.status === 'PASS').length;
    const total = r.tests.length;
    const tests = `${passes}/${total}`;
    const statusIcon = r.status === 'PASS' ? '✅ PASS' : 
                       r.status === 'FAIL' ? '❌ FAIL' : 
                       r.status === 'PARTIAL' ? '⚠️ PARTIAL' : '🔴 ERROR';
    const issues = r.issues.length > 0 ? `${r.issues.length} issue(s)` : '-';
    
    console.log(`║ ${r.vehicle.padEnd(30)} │ ${stag.padEnd(10)} │ ${exp.padEnd(8)} │ ${tests.padEnd(10)} │ ${statusIcon.padEnd(7)} │ ${issues.padEnd(24)} ║`);
  }
  
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  
  // Detailed issues
  const vehiclesWithIssues = allResults.filter(r => r.issues.length > 0);
  if (vehiclesWithIssues.length > 0) {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                       DETAILED ISSUES                                                    ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
    
    for (const r of vehiclesWithIssues) {
      console.log(`\n❌ ${r.vehicle}:`);
      for (const issue of r.issues) {
        console.log(`   • ${issue}`);
      }
    }
  }
  
  // Pattern analysis
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                      PATTERN ANALYSIS                                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  
  const totalVehicles = allResults.length;
  const passVehicles = allResults.filter(r => r.status === 'PASS').length;
  const failVehicles = allResults.filter(r => r.status === 'FAIL').length;
  const partialVehicles = allResults.filter(r => r.status === 'PARTIAL').length;
  
  console.log(`Vehicles tested: ${totalVehicles}`);
  console.log(`✅ PASS: ${passVehicles} (${(passVehicles/totalVehicles*100).toFixed(0)}%)`);
  console.log(`❌ FAIL: ${failVehicles} (${(failVehicles/totalVehicles*100).toFixed(0)}%)`);
  console.log(`⚠️ PARTIAL: ${partialVehicles} (${(partialVehicles/totalVehicles*100).toFixed(0)}%)`);
  
  // Staggered detection accuracy
  const correctStaggered = allResults.filter(r => r.expectStaggered === r.fitment?.isStaggered).length;
  console.log(`\nStaggered detection accuracy: ${correctStaggered}/${totalVehicles} (${(correctStaggered/totalVehicles*100).toFixed(0)}%)`);
  
  // Common failure patterns
  const allIssues = allResults.flatMap(r => r.issues);
  if (allIssues.length > 0) {
    console.log(`\nCommon issues:`);
    const issueCounts = {};
    for (const issue of allIssues) {
      const key = issue.replace(/\d+/g, 'N').replace(/-N+/g, '-N');
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    }
    for (const [pattern, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${count}x: ${pattern}`);
    }
  }
  
  // Save results
  const fs = require('fs');
  const outputPath = './scripts/staggered-audit-v2-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\n📄 Full results saved to: ${outputPath}`);
}

runAudit().catch(console.error);
