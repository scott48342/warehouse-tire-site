#!/usr/bin/env node
/**
 * Demo Readiness Test - 50 Vehicle Sweep
 * Tests wheel AND tire APIs for a representative sample of popular vehicles
 */

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

// 50 popular vehicles across makes/years/body types
const TEST_VEHICLES = [
  // Trucks
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT' },
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'Raptor' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT' },
  { year: 2024, make: 'RAM', model: '1500', trim: 'Big Horn' },
  { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'SR5' },
  { year: 2024, make: 'GMC', model: 'Sierra 1500', trim: 'SLE' },
  { year: 2024, make: 'Nissan', model: 'Titan', trim: 'SV' },
  
  // SUVs
  { year: 2024, make: 'Jeep', model: 'Grand Cherokee', trim: 'Limited' },
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon' },
  { year: 2024, make: 'Ford', model: 'Explorer', trim: 'XLT' },
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Badlands' },
  { year: 2024, make: 'Chevrolet', model: 'Tahoe', trim: 'LT' },
  { year: 2024, make: 'Chevrolet', model: 'Equinox', trim: 'LT' },
  { year: 2024, make: 'Toyota', model: '4Runner', trim: 'TRD Off-Road' },
  { year: 2024, make: 'Toyota', model: 'Highlander', trim: 'XLE' },
  { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'XLE' },
  { year: 2024, make: 'Honda', model: 'CR-V', trim: 'EX-L' },
  { year: 2024, make: 'Honda', model: 'Pilot', trim: 'EX-L' },
  { year: 2024, make: 'Hyundai', model: 'Tucson', trim: 'SEL' },
  { year: 2024, make: 'Kia', model: 'Telluride', trim: 'EX' },
  { year: 2024, make: 'Subaru', model: 'Outback', trim: 'Premium' },
  { year: 2024, make: 'GMC', model: 'Yukon', trim: 'SLT' },
  { year: 2024, make: 'Nissan', model: 'Pathfinder', trim: 'SL' },
  
  // Sedans
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'XSE' },
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'LE' },
  { year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport' },
  { year: 2024, make: 'Honda', model: 'Civic', trim: 'Sport' },
  { year: 2024, make: 'Hyundai', model: 'Sonata', trim: 'SEL' },
  { year: 2024, make: 'Hyundai', model: 'Elantra', trim: 'SEL' },
  { year: 2024, make: 'Kia', model: 'K5', trim: 'GT-Line' },
  { year: 2024, make: 'Nissan', model: 'Altima', trim: 'SV' },
  { year: 2024, make: 'Subaru', model: 'Legacy', trim: 'Premium' },
  
  // Crossovers / Compact SUVs
  { year: 2022, make: 'Buick', model: 'Encore GX', trim: 'Preferred' },
  { year: 2024, make: 'Buick', model: 'Enclave', trim: 'Avenir' },
  { year: 2024, make: 'Chevrolet', model: 'Trax', trim: 'LT' },
  { year: 2024, make: 'Ford', model: 'Escape', trim: 'ST-Line' },
  { year: 2024, make: 'Mazda', model: 'CX-5', trim: 'Touring' },
  { year: 2024, make: 'Mazda', model: 'CX-50', trim: 'Turbo' },
  
  // Performance / Sports
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT' },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS' },
  { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'R/T' },
  { year: 2024, make: 'Dodge', model: 'Charger', trim: 'R/T' },
  { year: 2024, make: 'Subaru', model: 'WRX', trim: 'Premium' },
  
  // Older model years (to test year range)
  { year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE' },
  { year: 2021, make: 'Ford', model: 'F-150', trim: 'Lariat' },
  { year: 2022, make: 'Honda', model: 'Accord', trim: 'EX-L' },
  { year: 2019, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT' },
  { year: 2023, make: 'Jeep', model: 'Wrangler', trim: 'Sport' },
  { year: 2022, make: 'RAM', model: '1500', trim: 'Laramie' },
];

async function testVehicle(vehicle) {
  const { year, make, model, trim } = vehicle;
  const wheelUrl = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}`;
  const tireUrl = `${BASE_URL}/api/tires/search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}`;
  
  try {
    // Test wheels
    const wheelRes = await fetch(wheelUrl);
    const wheelData = await wheelRes.json();
    
    const hasProfile = !!wheelData.fitment?.dbProfile;
    const wheelCount = wheelData.results?.length || 0;
    const resolutionPath = wheelData.fitment?.resolutionPath || 'unknown';
    
    // Test tires
    const tireRes = await fetch(tireUrl);
    const tireData = await tireRes.json();
    
    const tireCount = tireData.results?.length || 0;
    const tireSizes = [...new Set(tireData.results?.map(t => t.size) || [])];
    const hasTires = tireCount > 0;
    
    // Success criteria for demo:
    // - Has profile (vehicle found in DB)
    // - Has wheels (inventory matched)
    // - Has tires (can complete package)
    const status = hasProfile && wheelCount > 0 && hasTires ? '✅ PASS' : '❌ FAIL';
    
    return {
      vehicle: `${year} ${make} ${model} ${trim}`,
      status,
      hasProfile,
      wheelCount,
      tireCount,
      tireSizes: tireSizes.slice(0, 4).join(', ') + (tireSizes.length > 4 ? '...' : ''),
      resolutionPath,
      issues: [
        !hasProfile && 'NO_PROFILE',
        wheelCount === 0 && 'NO_WHEELS',
        !hasTires && 'NO_TIRES',
      ].filter(Boolean),
    };
  } catch (err) {
    return {
      vehicle: `${year} ${make} ${model} ${trim}`,
      status: '💥 ERROR',
      error: err.message,
      issues: ['FETCH_ERROR'],
    };
  }
}

async function runTests() {
  console.log(`\n🔍 Demo Readiness Test - ${TEST_VEHICLES.length} Vehicles`);
  console.log(`📡 Target: ${BASE_URL}\n`);
  console.log('='.repeat(110));
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const vehicle of TEST_VEHICLES) {
    const result = await testVehicle(vehicle);
    results.push(result);
    
    if (result.status === '✅ PASS') {
      passed++;
      console.log(`${result.status} ${result.vehicle.padEnd(40)} | ${String(result.wheelCount).padStart(4)} wheels | ${String(result.tireCount).padStart(4)} tires | ${result.tireSizes}`);
    } else {
      failed++;
      console.log(`${result.status} ${result.vehicle.padEnd(40)} | Issues: ${result.issues.join(', ')} | Path: ${result.resolutionPath}`);
    }
  }
  
  console.log('='.repeat(110));
  console.log(`\n📊 RESULTS: ${passed}/${TEST_VEHICLES.length} passed (${Math.round(passed/TEST_VEHICLES.length*100)}%)`);
  
  if (failed > 0) {
    console.log(`\n❌ FAILURES (${failed}):`);
    results
      .filter(r => r.status !== '✅ PASS')
      .forEach(r => {
        console.log(`  - ${r.vehicle}`);
        console.log(`    Issues: ${r.issues.join(', ')}`);
        if (r.resolutionPath) console.log(`    Resolution: ${r.resolutionPath}`);
      });
  }
  
  // Group failures by issue type
  const issueGroups = {};
  results.filter(r => r.issues?.length > 0).forEach(r => {
    r.issues.forEach(issue => {
      if (!issueGroups[issue]) issueGroups[issue] = [];
      issueGroups[issue].push(r.vehicle);
    });
  });
  
  if (Object.keys(issueGroups).length > 0) {
    console.log('\n📋 ISSUES BY TYPE:');
    for (const [issue, vehicles] of Object.entries(issueGroups)) {
      console.log(`  ${issue}: ${vehicles.length} vehicles`);
    }
  }
  
  return { passed, failed, total: TEST_VEHICLES.length, results };
}

runTests().catch(console.error);
