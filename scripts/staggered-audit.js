/**
 * Staggered Fitment Audit Script
 * Tests tire sizing follows wheel diameter across multiple vehicles
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const TEST_VEHICLES = [
  // C7 Corvette
  { year: 2019, make: 'Chevrolet', model: 'Corvette', trim: 'Grand Sport', name: 'C7 Corvette Grand Sport' },
  // C8 Corvette  
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', name: 'C8 Corvette Stingray' },
  // Mustang GT Performance Pack
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack', name: 'Mustang GT Perf Pack' },
  // BMW M3
  { year: 2024, make: 'BMW', model: 'M3', trim: '', name: 'BMW M3' },
  // BMW M4
  { year: 2024, make: 'BMW', model: 'M4', trim: '', name: 'BMW M4' },
  // Charger (widebody)
  { year: 2023, make: 'Dodge', model: 'Charger', trim: 'Scat Pack Widebody', name: 'Charger Scat Pack WB' },
  // Camaro
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS 1LE', name: 'Camaro SS 1LE' },
  // F-150 (should NOT be staggered)
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', name: 'F-150 XLT' },
  // Tesla Model 3
  { year: 2024, make: 'Tesla', model: 'Model 3', trim: 'Performance', name: 'Tesla Model 3 Perf' },
  // Camry (should NOT be staggered)
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'XSE', name: 'Camry XSE' },
];

// Wheel diameter test cases
const DIAMETER_TESTS = [
  { name: 'mixed 19/20', front: 19, rear: 20 },
  { name: 'same 20/20', front: 20, rear: 20 },
  { name: 'same 19/19', front: 19, rear: 19 },
];

async function fetchJson(url) {
  try {
    const res = await fetch(url, { timeout: 30000 });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

function extractDiameter(tireSize) {
  // Parse tire size like "255/40R19" or "P255/40ZR19"
  const match = tireSize?.match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

async function testVehicle(vehicle) {
  const results = {
    vehicle: vehicle.name,
    oemTireSizes: [],
    isStaggered: null,
    staggeredReason: null,
    frontSpec: null,
    rearSpec: null,
    tests: [],
    errors: []
  };

  // 1. Get OEM tire sizes
  const tireSizesUrl = `${BASE_URL}/api/vehicles/tire-sizes?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&modification=${encodeURIComponent(vehicle.trim)}` : ''}`;
  const tireSizes = await fetchJson(tireSizesUrl);
  
  if (tireSizes.error) {
    results.errors.push(`tire-sizes: ${tireSizes.error}`);
  } else {
    results.oemTireSizes = tireSizes.sizes || [];
  }

  // 2. Get fitment search (includes staggered detection)
  const fitmentUrl = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&trim=${encodeURIComponent(vehicle.trim)}` : ''}&pageSize=1`;
  const fitment = await fetchJson(fitmentUrl);

  if (fitment.error) {
    results.errors.push(`fitment-search: ${fitment.error}`);
  } else {
    results.isStaggered = fitment.fitment?.staggered?.isStaggered || false;
    results.staggeredReason = fitment.fitment?.staggered?.reason || 'N/A';
    results.frontSpec = fitment.fitment?.staggered?.frontSpec || null;
    results.rearSpec = fitment.fitment?.staggered?.rearSpec || null;
  }

  // 3. Test tire page with different wheel diameters
  for (const diamTest of DIAMETER_TESTS) {
    const testResult = {
      scenario: diamTest.name,
      wheelFront: diamTest.front,
      wheelRear: diamTest.rear,
      tireSizesFront: [],
      tireSizesRear: [],
      frontDiameterMatch: null,
      rearDiameterMatch: null,
      status: 'UNKNOWN'
    };

    // For staggered: simulate selecting wheels, then check tire page
    // The tire page URL format: /tires?year=X&make=Y&model=Z&trim=T&staggered=true&wheelDia=F&rearWheelDia=R
    const tiresPageUrl = `${BASE_URL}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&trim=${encodeURIComponent(vehicle.trim)}` : ''}&wheelDiameter=${diamTest.front}${diamTest.front !== diamTest.rear ? `&rearWheelDiameter=${diamTest.rear}` : ''}&pageSize=1`;
    
    const tiresSearch = await fetchJson(tiresPageUrl);
    
    if (tiresSearch.error) {
      testResult.status = 'ERROR';
      results.errors.push(`tires-search (${diamTest.name}): ${tiresSearch.error}`);
    } else {
      // Extract what tire sizes were searched/returned
      testResult.tireSizesFront = tiresSearch.searchedSizes?.front || tiresSearch.searchedSize ? [tiresSearch.searchedSize] : [];
      testResult.tireSizesRear = tiresSearch.searchedSizes?.rear || [];
      
      // Check if we have plus-size or size resolution info
      if (tiresSearch.sizeResolution) {
        testResult.tireSizesFront = [tiresSearch.sizeResolution.frontSize || tiresSearch.sizeResolution.selectedSize];
        testResult.tireSizesRear = tiresSearch.sizeResolution.rearSize ? [tiresSearch.sizeResolution.rearSize] : [];
      }
      
      // Validate front tire diameter matches front wheel
      if (testResult.tireSizesFront.length > 0) {
        const frontTireDia = extractDiameter(testResult.tireSizesFront[0]);
        testResult.frontDiameterMatch = frontTireDia === diamTest.front;
      }
      
      // Validate rear tire diameter matches rear wheel (if staggered)
      if (testResult.tireSizesRear.length > 0) {
        const rearTireDia = extractDiameter(testResult.tireSizesRear[0]);
        testResult.rearDiameterMatch = rearTireDia === diamTest.rear;
      }
      
      // Determine status
      if (testResult.frontDiameterMatch === false || testResult.rearDiameterMatch === false) {
        testResult.status = 'FAIL';
      } else if (testResult.frontDiameterMatch === true && 
                 (testResult.tireSizesRear.length === 0 || testResult.rearDiameterMatch === true)) {
        testResult.status = 'PASS';
      } else {
        testResult.status = 'PARTIAL';
      }
    }
    
    results.tests.push(testResult);
  }

  return results;
}

async function runAudit() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           STAGGERED FITMENT AUDIT - Retail Site                      ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Base URL: ${BASE_URL.padEnd(57)} ║`);
  console.log(`║ Vehicles: ${TEST_VEHICLES.length.toString().padEnd(57)} ║`);
  console.log(`║ Test Scenarios: ${DIAMETER_TESTS.map(d => d.name).join(', ').padEnd(51)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const allResults = [];
  
  for (const vehicle of TEST_VEHICLES) {
    process.stdout.write(`Testing ${vehicle.name}...`);
    const result = await testVehicle(vehicle);
    allResults.push(result);
    console.log(` ${result.isStaggered ? '🔀 STAGGERED' : '⬜ STANDARD'}`);
  }

  // Summary table
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY TABLE');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('Vehicle                    │ Staggered │ OEM Tires                  │ 19/20    │ 20/20    │ 19/19   ');
  console.log('───────────────────────────┼───────────┼────────────────────────────┼──────────┼──────────┼─────────');
  
  for (const r of allResults) {
    const stag = r.isStaggered ? 'YES' : 'NO';
    const oem = r.oemTireSizes.slice(0, 2).join(', ').substring(0, 26) || 'N/A';
    const t1 = r.tests[0]?.status || 'N/A';
    const t2 = r.tests[1]?.status || 'N/A';
    const t3 = r.tests[2]?.status || 'N/A';
    
    const statusIcon = (s) => {
      if (s === 'PASS') return '✅ PASS';
      if (s === 'FAIL') return '❌ FAIL';
      if (s === 'PARTIAL') return '⚠️  PART';
      if (s === 'ERROR') return '🔴 ERR';
      return '❓ N/A';
    };
    
    console.log(`${r.vehicle.padEnd(26)} │ ${stag.padEnd(9)} │ ${oem.padEnd(26)} │ ${statusIcon(t1).padEnd(8)} │ ${statusIcon(t2).padEnd(8)} │ ${statusIcon(t3)}`);
  }
  
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');

  // Failure details
  const failures = [];
  for (const r of allResults) {
    for (const t of r.tests) {
      if (t.status === 'FAIL' || t.status === 'PARTIAL') {
        failures.push({
          vehicle: r.vehicle,
          scenario: t.scenario,
          wheelFront: t.wheelFront,
          wheelRear: t.wheelRear,
          tireFront: t.tireSizesFront[0] || 'none',
          tireRear: t.tireSizesRear[0] || 'none',
          frontMatch: t.frontDiameterMatch,
          rearMatch: t.rearDiameterMatch,
          status: t.status
        });
      }
    }
  }

  if (failures.length > 0) {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('FAILURES / PARTIAL PASSES');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
    for (const f of failures) {
      console.log(`\n❌ ${f.vehicle} - ${f.scenario}`);
      console.log(`   Wheels: Front=${f.wheelFront}" Rear=${f.wheelRear}"`);
      console.log(`   Tires:  Front=${f.tireFront} (match: ${f.frontMatch}) Rear=${f.tireRear} (match: ${f.rearMatch})`);
    }
  }

  // Error summary
  const allErrors = allResults.flatMap(r => r.errors.map(e => ({ vehicle: r.vehicle, error: e })));
  if (allErrors.length > 0) {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('ERRORS');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
    for (const e of allErrors) {
      console.log(`  ${e.vehicle}: ${e.error}`);
    }
  }

  // Staggered detection summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('STAGGERED DETECTION DETAILS');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
  for (const r of allResults) {
    if (r.isStaggered) {
      console.log(`\n🔀 ${r.vehicle}`);
      console.log(`   Reason: ${r.staggeredReason}`);
      if (r.frontSpec) console.log(`   Front Spec: ${r.frontSpec.diameter}"x${r.frontSpec.width} → ${r.frontSpec.tireSize || 'unknown'}`);
      if (r.rearSpec) console.log(`   Rear Spec:  ${r.rearSpec.diameter}"x${r.rearSpec.width} → ${r.rearSpec.tireSize || 'unknown'}`);
    }
  }

  // Pattern analysis
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('PATTERN ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
  
  const totalTests = allResults.length * DIAMETER_TESTS.length;
  const passes = allResults.flatMap(r => r.tests).filter(t => t.status === 'PASS').length;
  const partials = allResults.flatMap(r => r.tests).filter(t => t.status === 'PARTIAL').length;
  const fails = allResults.flatMap(r => r.tests).filter(t => t.status === 'FAIL').length;
  const errors = allResults.flatMap(r => r.tests).filter(t => t.status === 'ERROR').length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ PASS: ${passes} (${(passes/totalTests*100).toFixed(1)}%)`);
  console.log(`⚠️  PARTIAL: ${partials} (${(partials/totalTests*100).toFixed(1)}%)`);
  console.log(`❌ FAIL: ${fails} (${(fails/totalTests*100).toFixed(1)}%)`);
  console.log(`🔴 ERROR: ${errors} (${(errors/totalTests*100).toFixed(1)}%)`);

  // Write JSON results
  const outputPath = './scripts/staggered-audit-results.json';
  const fs = require('fs');
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\n📄 Full results written to: ${outputPath}`);
}

runAudit().catch(console.error);
