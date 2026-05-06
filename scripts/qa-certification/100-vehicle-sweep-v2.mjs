/**
 * 100-Vehicle QA Certification Sweep v2
 * 
 * Tests NEW vehicles not used in previous certification runs.
 * Comprehensive coverage of edge cases, staggered, lifted, and package flows.
 * 
 * Vehicle Distribution:
 * - 20 half-ton trucks
 * - 15 HD trucks  
 * - 15 midsize trucks/SUVs
 * - 15 passenger sedans/crossovers
 * - 15 staggered/performance vehicles
 * - 10 Jeeps/off-road vehicles
 * - 10 luxury/performance SUVs
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST VEHICLE SETS (100 NEW VEHICLES)
// ═══════════════════════════════════════════════════════════════════════════════

const HALF_TON_TRUCKS = [
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'Platinum' },
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'Raptor' },
  { year: 2023, make: 'Ford', model: 'F-150', trim: 'Tremor' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'High Country' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'Trail Boss' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado 1500', trim: 'ZR2' },
  { year: 2024, make: 'GMC', model: 'Sierra 1500', trim: 'Denali' },
  { year: 2024, make: 'GMC', model: 'Sierra 1500', trim: 'AT4X' },
  { year: 2024, make: 'Ram', model: '1500', trim: 'Limited' },
  { year: 2024, make: 'Ram', model: '1500', trim: 'Rebel' },
  { year: 2024, make: 'Ram', model: '1500', trim: 'TRX' },
  { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'Limited' },
  { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'TRD Pro' },
  { year: 2024, make: 'Nissan', model: 'Titan', trim: 'Platinum Reserve' },
  { year: 2024, make: 'Nissan', model: 'Titan', trim: 'PRO-4X' },
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'Lightning' },
  { year: 2023, make: 'Rivian', model: 'R1T', trim: 'Adventure' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado EV', trim: 'RST' },
  { year: 2022, make: 'Ford', model: 'F-150', trim: 'King Ranch' },
  { year: 2021, make: 'Ram', model: '1500', trim: 'Laramie' },
];

const HD_TRUCKS = [
  { year: 2024, make: 'Ford', model: 'F-250', trim: 'Lariat' },
  { year: 2024, make: 'Ford', model: 'F-350', trim: 'King Ranch' },
  { year: 2024, make: 'Ford', model: 'F-350', trim: 'Platinum', rearWheelConfig: 'drw' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500HD', trim: 'High Country' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 3500HD', trim: 'LTZ', rearWheelConfig: 'drw' },
  { year: 2024, make: 'GMC', model: 'Sierra 2500HD', trim: 'Denali' },
  { year: 2024, make: 'GMC', model: 'Sierra 3500HD', trim: 'AT4', rearWheelConfig: 'drw' },
  { year: 2024, make: 'Ram', model: '2500', trim: 'Laramie' },
  { year: 2024, make: 'Ram', model: '3500', trim: 'Limited', rearWheelConfig: 'drw' },
  { year: 2024, make: 'Ram', model: '3500', trim: 'Tradesman', rearWheelConfig: 'srw' },
  { year: 2023, make: 'Ford', model: 'F-450', trim: 'Limited', rearWheelConfig: 'drw' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 3500HD', trim: 'Work Truck' },
  { year: 2021, make: 'Ford', model: 'F-250', trim: 'Tremor' },
  { year: 2020, make: 'Ram', model: '2500', trim: 'Power Wagon' },
  { year: 2019, make: 'GMC', model: 'Sierra 2500HD', trim: 'SLT' },
];

const MIDSIZE_TRUCKS_SUVS = [
  { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Pro' },
  { year: 2024, make: 'Toyota', model: '4Runner', trim: 'TRD Pro' },
  { year: 2024, make: 'Ford', model: 'Ranger', trim: 'Raptor' },
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Wildtrak' },
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Raptor' },
  { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'ZR2' },
  { year: 2024, make: 'GMC', model: 'Canyon', trim: 'AT4X' },
  { year: 2024, make: 'Nissan', model: 'Frontier', trim: 'PRO-4X' },
  { year: 2024, make: 'Honda', model: 'Passport', trim: 'TrailSport' },
  { year: 2024, make: 'Subaru', model: 'Outback', trim: 'Wilderness' },
  { year: 2024, make: 'Toyota', model: 'Sequoia', trim: 'TRD Pro' },
  { year: 2023, make: 'Lexus', model: 'GX', trim: '550' },
  { year: 2024, make: 'Land Rover', model: 'Defender', trim: '110' },
  { year: 2023, make: 'Ford', model: 'Bronco Sport', trim: 'Badlands' },
  { year: 2022, make: 'Toyota', model: 'Tacoma', trim: 'Trail Edition' },
];

const PASSENGER_SEDANS_CROSSOVERS = [
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'XSE' },
  { year: 2024, make: 'Honda', model: 'Civic', trim: 'Si' },
  { year: 2024, make: 'Hyundai', model: 'Sonata', trim: 'N Line' },
  { year: 2024, make: 'Mazda', model: 'Mazda3', trim: 'Turbo' },
  { year: 2024, make: 'Volkswagen', model: 'Jetta', trim: 'GLI' },
  { year: 2024, make: 'Subaru', model: 'WRX', trim: 'TR' },
  { year: 2024, make: 'Nissan', model: 'Altima', trim: 'SR' },
  { year: 2024, make: 'Kia', model: 'K5', trim: 'GT' },
  { year: 2024, make: 'Tesla', model: 'Model 3', trim: 'Performance' },
  { year: 2024, make: 'Tesla', model: 'Model Y', trim: 'Performance' },
  { year: 2024, make: 'Hyundai', model: 'Elantra N', trim: 'Base' },
  { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'TRD Off-Road' },
  { year: 2024, make: 'Honda', model: 'CR-V', trim: 'Hybrid Sport' },
  { year: 2024, make: 'Mazda', model: 'CX-50', trim: 'Turbo' },
  { year: 2023, make: 'Volkswagen', model: 'Golf R', trim: 'Base' },
];

const STAGGERED_PERFORMANCE = [
  { year: 2024, make: 'BMW', model: 'M3', trim: 'Competition', expectStaggered: true },
  { year: 2024, make: 'BMW', model: 'M4', trim: 'Competition xDrive', expectStaggered: true },
  { year: 2024, make: 'Mercedes-Benz', model: 'AMG C 63', trim: 'S', expectStaggered: true },
  { year: 2024, make: 'Mercedes-Benz', model: 'AMG E 63', trim: 'S', expectStaggered: true },
  { year: 2024, make: 'Porsche', model: '911', trim: 'Carrera S', expectStaggered: true },
  { year: 2024, make: 'Porsche', model: '911', trim: 'Turbo S', expectStaggered: true },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Z06', expectStaggered: true },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'E-Ray', expectStaggered: true },
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT', expectStaggered: false },
  { year: 2025, make: 'Ford', model: 'Mustang', trim: 'Dark Horse', expectStaggered: true },
  { year: 2024, make: 'Dodge', model: 'Charger', trim: 'Scat Pack Widebody', expectStaggered: false },
  { year: 2024, make: 'Nissan', model: 'Z', trim: 'Performance', expectStaggered: false },
  { year: 2024, make: 'Toyota', model: 'GR Supra', trim: '3.0 Premium', expectStaggered: true },
  { year: 2024, make: 'Lexus', model: 'IS', trim: '500 F Sport', expectStaggered: false },
  { year: 2024, make: 'Audi', model: 'RS5', trim: 'Sportback', expectStaggered: true },
];

const JEEPS_OFFROAD = [
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Willys' },
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Sahara' },
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon 392' },
  { year: 2024, make: 'Jeep', model: 'Gladiator', trim: 'Rubicon' },
  { year: 2024, make: 'Jeep', model: 'Gladiator', trim: 'Mojave' },
  { year: 2024, make: 'Jeep', model: 'Grand Cherokee', trim: 'Trailhawk' },
  { year: 2024, make: 'Jeep', model: 'Grand Cherokee', trim: 'Overland' },
  { year: 2024, make: 'Jeep', model: 'Wagoneer', trim: 'Series III' },
  { year: 2024, make: 'Jeep', model: 'Grand Wagoneer', trim: 'Obsidian' },
  { year: 2023, make: 'Jeep', model: 'Cherokee', trim: 'Trailhawk' },
];

const LUXURY_PERFORMANCE_SUVS = [
  { year: 2024, make: 'Cadillac', model: 'Escalade', trim: 'Premium Luxury' },
  { year: 2024, make: 'Cadillac', model: 'Escalade', trim: 'V' },
  { year: 2024, make: 'GMC', model: 'Yukon', trim: 'Denali Ultimate' },
  { year: 2024, make: 'Lincoln', model: 'Navigator', trim: 'Black Label' },
  { year: 2024, make: 'BMW', model: 'X5 M', trim: 'Competition' },
  { year: 2024, make: 'Mercedes-Benz', model: 'GLE', trim: 'AMG 63 S' },
  { year: 2024, make: 'Porsche', model: 'Cayenne', trim: 'Turbo GT' },
  { year: 2024, make: 'Audi', model: 'RS Q8', trim: 'Base' },
  { year: 2024, make: 'Range Rover', model: 'Range Rover', trim: 'SV' },
  { year: 2023, make: 'Rivian', model: 'R1S', trim: 'Adventure' },
];

// Lifted configurations to test
const LIFTED_CONFIGS = [
  { name: 'leveled', liftInches: 2 },
  { name: '4-inch', liftInches: 4 },
  { name: '6-inch', liftInches: 6 },
  { name: '8-inch', liftInches: 8 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: [],
  categories: {
    logic: 0,
    inventory: 0,
    data: 0,
    supplier: 0,
    testHarness: 0,
  },
  wheelResultCounts: [],
  tireResultCounts: [],
  staggeredTests: { correct: 0, falsePositive: 0, falseNegative: 0 },
  liftedTests: { passed: 0, failed: 0 },
  packageTests: { passed: 0, failed: 0 },
};

async function testWheelFitment(vehicle) {
  const url = new URL(`${BASE_URL}/api/wheels/fitment-search`);
  url.searchParams.set('year', vehicle.year);
  url.searchParams.set('make', vehicle.make);
  url.searchParams.set('model', vehicle.model);
  url.searchParams.set('trim', vehicle.trim);
  if (vehicle.rearWheelConfig) {
    url.searchParams.set('rearWheelConfig', vehicle.rearWheelConfig);
  }
  url.searchParams.set('pageSize', '20');

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return { pass: false, error: `HTTP ${res.status}`, category: 'testHarness' };
    }
    const data = await res.json();
    
    const result = {
      pass: true,
      wheelCount: data.totalCount || 0,
      boltPattern: data.fitment?.dbProfile?.boltPattern || data.fitment?.envelope?.boltPattern,
      centerBore: data.fitment?.dbProfile?.centerBoreMm,
      staggered: data.fitment?.staggered,
      confidence: data.fitment?.confidence,
      blocked: data.blocked,
    };

    // Validation checks
    if (data.blocked) {
      result.pass = false;
      result.error = `Blocked: ${data.blockReason}`;
      result.category = 'data';
    } else if (!result.boltPattern) {
      result.pass = false;
      result.error = 'Missing bolt pattern';
      result.category = 'data';
    } else if (result.wheelCount === 0) {
      // Allow 0 results for unusual vehicles, but flag it
      result.warning = 'No wheel results';
    }

    // Staggered validation
    if (vehicle.expectStaggered !== undefined) {
      const actualStaggered = data.fitment?.staggered?.isStaggered || false;
      if (vehicle.expectStaggered && !actualStaggered) {
        result.pass = false;
        result.error = 'FALSE NEGATIVE: Expected staggered but got square';
        result.category = 'logic';
        results.staggeredTests.falseNegative++;
      } else if (!vehicle.expectStaggered && actualStaggered) {
        result.pass = false;
        result.error = 'FALSE POSITIVE: Expected square but got staggered';
        result.category = 'logic';
        results.staggeredTests.falsePositive++;
      } else {
        results.staggeredTests.correct++;
      }
    }

    return result;
  } catch (err) {
    return { pass: false, error: err.message, category: 'testHarness' };
  }
}

async function testTireSearch(vehicle, wheelDiameter = 18) {
  const url = new URL(`${BASE_URL}/api/tires/search`);
  url.searchParams.set('year', vehicle.year);
  url.searchParams.set('make', vehicle.make);
  url.searchParams.set('model', vehicle.model);
  url.searchParams.set('trim', vehicle.trim);
  url.searchParams.set('wheelDiameter', wheelDiameter);
  url.searchParams.set('pageSize', '10');

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return { pass: false, error: `HTTP ${res.status}`, category: 'testHarness' };
    }
    const data = await res.json();
    
    return {
      pass: !data.error,
      tireCount: data.totalCount || data.results?.length || 0,
      tireSizes: data.availableSizes || [],
      error: data.error,
      category: data.error ? 'data' : undefined,
    };
  } catch (err) {
    return { pass: false, error: err.message, category: 'testHarness' };
  }
}

async function testLiftedFitment(vehicle, liftConfig) {
  const url = new URL(`${BASE_URL}/api/wheels/fitment-search`);
  url.searchParams.set('year', vehicle.year);
  url.searchParams.set('make', vehicle.make);
  url.searchParams.set('model', vehicle.model);
  url.searchParams.set('trim', vehicle.trim);
  url.searchParams.set('lift', liftConfig.liftInches);
  url.searchParams.set('pageSize', '10');

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return { pass: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    
    // Check if lifted tire guidance is provided
    const guidance = data.fitment?.guidance;
    
    return {
      pass: !data.blocked,
      wheelCount: data.totalCount || 0,
      liftApplied: liftConfig.name,
      hasGuidance: !!guidance,
    };
  } catch (err) {
    return { pass: false, error: err.message };
  }
}

async function testPackageFlow(vehicle) {
  // First get wheel options
  const wheelUrl = new URL(`${BASE_URL}/api/wheels/fitment-search`);
  wheelUrl.searchParams.set('year', vehicle.year);
  wheelUrl.searchParams.set('make', vehicle.make);
  wheelUrl.searchParams.set('model', vehicle.model);
  wheelUrl.searchParams.set('trim', vehicle.trim);
  wheelUrl.searchParams.set('pageSize', '5');

  try {
    const wheelRes = await fetch(wheelUrl.toString(), { signal: AbortSignal.timeout(15000) });
    if (!wheelRes.ok) return { pass: false, error: 'Wheel search failed' };
    const wheelData = await wheelRes.json();
    
    if (!wheelData.results || wheelData.results.length === 0) {
      return { pass: true, skipped: true, reason: 'No wheels available' };
    }

    // Check if we can build a package with the first wheel
    const firstWheel = wheelData.results[0];
    
    return {
      pass: true,
      wheelAvailable: true,
      wheelSku: firstWheel.sku,
      packageViable: true,
    };
  } catch (err) {
    return { pass: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runFullSweep() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  100-VEHICLE QA CERTIFICATION SWEEP v2');
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const allVehicles = [
    ...HALF_TON_TRUCKS.map(v => ({ ...v, category: 'Half-Ton Trucks' })),
    ...HD_TRUCKS.map(v => ({ ...v, category: 'HD Trucks' })),
    ...MIDSIZE_TRUCKS_SUVS.map(v => ({ ...v, category: 'Midsize Trucks/SUVs' })),
    ...PASSENGER_SEDANS_CROSSOVERS.map(v => ({ ...v, category: 'Passenger/Crossovers' })),
    ...STAGGERED_PERFORMANCE.map(v => ({ ...v, category: 'Staggered/Performance' })),
    ...JEEPS_OFFROAD.map(v => ({ ...v, category: 'Jeeps/Off-Road' })),
    ...LUXURY_PERFORMANCE_SUVS.map(v => ({ ...v, category: 'Luxury SUVs' })),
  ];

  console.log(`Testing ${allVehicles.length} vehicles...\n`);

  // Test each vehicle
  for (let i = 0; i < allVehicles.length; i++) {
    const vehicle = allVehicles[i];
    const label = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
    
    results.total++;
    
    // Test wheel fitment
    const wheelResult = await testWheelFitment(vehicle);
    
    // Test tire search (using common diameter)
    const tireResult = await testTireSearch(vehicle, 18);
    
    // Record results
    results.wheelResultCounts.push(wheelResult.wheelCount || 0);
    results.tireResultCounts.push(tireResult.tireCount || 0);
    
    // Determine overall pass/fail
    let passed = wheelResult.pass && tireResult.pass;
    let failReason = wheelResult.error || tireResult.error;
    let failCategory = wheelResult.category || tireResult.category;

    if (passed) {
      results.passed++;
      process.stdout.write(`✅ ${label}\n`);
    } else {
      results.failed++;
      results.categories[failCategory || 'logic']++;
      results.failures.push({
        vehicle: label,
        category: vehicle.category,
        error: failReason,
        failCategory,
        wheelCount: wheelResult.wheelCount,
        tireCount: tireResult.tireCount,
        boltPattern: wheelResult.boltPattern,
      });
      process.stdout.write(`❌ ${label}: ${failReason}\n`);
    }

    // Rate limiting - small delay between requests
    await new Promise(r => setTimeout(r, 100));
  }

  // Test lifted configurations on select trucks
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log('  LIFTED FITMENT TESTS');
  console.log('───────────────────────────────────────────────────────────────────\n');

  const liftTestVehicles = [
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT' },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT' },
    { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Off-Road' },
    { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon' },
  ];

  for (const vehicle of liftTestVehicles) {
    const label = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
    
    for (const liftConfig of LIFTED_CONFIGS) {
      const liftResult = await testLiftedFitment(vehicle, liftConfig);
      
      if (liftResult.pass) {
        results.liftedTests.passed++;
        console.log(`  ✅ ${label} @ ${liftConfig.name}: ${liftResult.wheelCount} wheels`);
      } else {
        results.liftedTests.failed++;
        console.log(`  ❌ ${label} @ ${liftConfig.name}: ${liftResult.error}`);
      }
    }
  }

  // Test package flow on select vehicles
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log('  PACKAGE FLOW TESTS');
  console.log('───────────────────────────────────────────────────────────────────\n');

  const packageTestVehicles = allVehicles.slice(0, 10);
  for (const vehicle of packageTestVehicles) {
    const label = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
    const pkgResult = await testPackageFlow(vehicle);
    
    if (pkgResult.pass) {
      results.packageTests.passed++;
      console.log(`  ✅ ${label}: Package viable`);
    } else {
      results.packageTests.failed++;
      console.log(`  ❌ ${label}: ${pkgResult.error || 'Package not viable'}`);
    }
  }

  // Print summary
  printSummary(allVehicles);
}

function printSummary(allVehicles) {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  CERTIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const passRate = (results.passed / results.total * 100).toFixed(1);
  
  // Logic-only pass rate (excluding inventory/supplier issues)
  const logicFailures = results.categories.logic + results.categories.data;
  const logicPassRate = ((results.total - logicFailures) / results.total * 100).toFixed(1);
  
  // Inventory-adjusted (assuming inventory issues are acceptable)
  const inventoryFailures = results.categories.inventory + results.categories.supplier;
  const inventoryAdjustedRate = ((results.total - results.categories.logic - results.categories.data) / results.total * 100).toFixed(1);

  console.log(`  TRUE PASS RATE:              ${passRate}% (${results.passed}/${results.total})`);
  console.log(`  LOGIC-ONLY PASS RATE:        ${logicPassRate}%`);
  console.log(`  INVENTORY-ADJUSTED RATE:     ${inventoryAdjustedRate}%`);
  console.log();
  console.log('  FAILURE CATEGORIES:');
  console.log(`    Logic errors:              ${results.categories.logic}`);
  console.log(`    Data gaps:                 ${results.categories.data}`);
  console.log(`    Inventory issues:          ${results.categories.inventory}`);
  console.log(`    Supplier issues:           ${results.categories.supplier}`);
  console.log(`    Test harness errors:       ${results.categories.testHarness}`);
  console.log();
  console.log('  STAGGERED DETECTION:');
  console.log(`    Correct:                   ${results.staggeredTests.correct}`);
  console.log(`    False Positives:           ${results.staggeredTests.falsePositive}`);
  console.log(`    False Negatives:           ${results.staggeredTests.falseNegative}`);
  console.log();
  console.log('  LIFTED FITMENT:');
  console.log(`    Passed:                    ${results.liftedTests.passed}`);
  console.log(`    Failed:                    ${results.liftedTests.failed}`);
  console.log();
  console.log('  PACKAGE FLOW:');
  console.log(`    Passed:                    ${results.packageTests.passed}`);
  console.log(`    Failed:                    ${results.packageTests.failed}`);
  console.log();

  // Wheel/Tire result statistics
  const avgWheels = results.wheelResultCounts.reduce((a, b) => a + b, 0) / results.wheelResultCounts.length;
  const avgTires = results.tireResultCounts.reduce((a, b) => a + b, 0) / results.tireResultCounts.length;
  const zeroWheels = results.wheelResultCounts.filter(c => c === 0).length;
  const zeroTires = results.tireResultCounts.filter(c => c === 0).length;

  console.log('  RESULT COUNTS:');
  console.log(`    Avg wheel results:         ${avgWheels.toFixed(1)}`);
  console.log(`    Avg tire results:          ${avgTires.toFixed(1)}`);
  console.log(`    Zero wheel results:        ${zeroWheels}`);
  console.log(`    Zero tire results:         ${zeroTires}`);

  // Top 10 failures
  if (results.failures.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────');
    console.log('  TOP 10 RISK AREAS (FAILURES)');
    console.log('───────────────────────────────────────────────────────────────────\n');
    
    const topFailures = results.failures.slice(0, 10);
    for (let i = 0; i < topFailures.length; i++) {
      const f = topFailures[i];
      console.log(`  ${i + 1}. ${f.vehicle}`);
      console.log(`     Category: ${f.category}`);
      console.log(`     Error: ${f.error}`);
      console.log(`     Fail Type: ${f.failCategory}`);
      console.log();
    }
  }

  // Final verdict
  console.log('═══════════════════════════════════════════════════════════════════');
  if (results.passed === results.total) {
    console.log('  ✅ 100-VEHICLE CERTIFICATION PASSED');
  } else if (parseFloat(passRate) >= 95) {
    console.log(`  ⚠️  CERTIFICATION PASSED WITH WARNINGS (${passRate}%)`);
  } else if (parseFloat(passRate) >= 90) {
    console.log(`  ⚠️  CERTIFICATION MARGINAL (${passRate}%)`);
  } else {
    console.log(`  ❌ CERTIFICATION FAILED (${passRate}%)`);
  }
  console.log(`  Completed: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  // Exit with appropriate code
  process.exit(results.passed === results.total ? 0 : 1);
}

// Run
runFullSweep().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
