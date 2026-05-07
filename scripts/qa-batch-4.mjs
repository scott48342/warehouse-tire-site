// QA Batch 4 - Staggered/Performance + Passenger Cars + SUVs
// Test against live site: https://shop.warehousetiredirect.com

const BASE_URL = 'https://shop.warehousetiredirect.com';

// 30 Staggered Performance Cars (various years)
const staggeredPerformance = [
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT' },
  { year: 2023, make: 'Ford', model: 'Mustang', trim: 'GT' },
  { year: 2022, make: 'Ford', model: 'Mustang', trim: 'GT' },
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'Dark Horse' },
  { year: 2020, make: 'Ford', model: 'Mustang', trim: 'Shelby GT500' },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS' },
  { year: 2023, make: 'Chevrolet', model: 'Camaro', trim: 'SS' },
  { year: 2022, make: 'Chevrolet', model: 'Camaro', trim: 'ZL1' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray' },
  { year: 2023, make: 'Chevrolet', model: 'Corvette', trim: 'Z06' },
  { year: 2022, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray' },
  { year: 2024, make: 'BMW', model: 'M3', trim: 'Base' },
  { year: 2023, make: 'BMW', model: 'M3', trim: 'Competition' },
  { year: 2024, make: 'BMW', model: 'M4', trim: 'Base' },
  { year: 2023, make: 'BMW', model: 'M4', trim: 'Competition' },
  { year: 2022, make: 'BMW', model: 'M4', trim: 'Base' },
  { year: 2024, make: 'Mercedes-Benz', model: 'AMG GT', trim: 'Base' },
  { year: 2023, make: 'Mercedes-Benz', model: 'C-Class', trim: 'AMG C 63' },
  { year: 2022, make: 'Mercedes-Benz', model: 'E-Class', trim: 'AMG E 63' },
  { year: 2024, make: 'Porsche', model: '911', trim: 'Carrera' },
  { year: 2023, make: 'Porsche', model: '911', trim: 'Carrera S' },
  { year: 2022, make: 'Porsche', model: '911', trim: 'Turbo' },
  { year: 2024, make: 'Porsche', model: '911', trim: 'GT3' },
  { year: 2023, make: 'Dodge', model: 'Challenger', trim: 'Hellcat' },
  { year: 2022, make: 'Dodge', model: 'Challenger', trim: 'Scat Pack Widebody' },
  { year: 2024, make: 'Nissan', model: '370Z', trim: 'Base' },
  { year: 2023, make: 'Nissan', model: 'Z', trim: 'Performance' },
  { year: 2024, make: 'Lexus', model: 'RC F', trim: 'Base' },
  { year: 2023, make: 'Audi', model: 'RS 5', trim: 'Base' },
  { year: 2022, make: 'BMW', model: 'M2', trim: 'Competition' },
];

// 40 Passenger Sedans/Crossovers
const passengerCars = [
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'LE' },
  { year: 2023, make: 'Toyota', model: 'Camry', trim: 'SE' },
  { year: 2022, make: 'Toyota', model: 'Camry', trim: 'XLE' },
  { year: 2024, make: 'Honda', model: 'Civic', trim: 'LX' },
  { year: 2023, make: 'Honda', model: 'Civic', trim: 'Sport' },
  { year: 2022, make: 'Honda', model: 'Civic', trim: 'Touring' },
  { year: 2024, make: 'Honda', model: 'Accord', trim: 'LX' },
  { year: 2023, make: 'Honda', model: 'Accord', trim: 'Sport' },
  { year: 2022, make: 'Honda', model: 'Accord', trim: 'Touring' },
  { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'LE' },
  { year: 2023, make: 'Toyota', model: 'RAV4', trim: 'XLE' },
  { year: 2022, make: 'Toyota', model: 'RAV4', trim: 'Limited' },
  { year: 2021, make: 'Toyota', model: 'RAV4', trim: 'LE' },
  { year: 2024, make: 'Honda', model: 'CR-V', trim: 'LX' },
  { year: 2023, make: 'Honda', model: 'CR-V', trim: 'EX' },
  { year: 2022, make: 'Honda', model: 'CR-V', trim: 'Touring' },
  { year: 2021, make: 'Honda', model: 'CR-V', trim: 'EX-L' },
  { year: 2024, make: 'Mazda', model: 'CX-5', trim: 'Sport' },
  { year: 2023, make: 'Mazda', model: 'CX-5', trim: 'Touring' },
  { year: 2022, make: 'Mazda', model: 'CX-5', trim: 'Grand Touring' },
  { year: 2024, make: 'Hyundai', model: 'Tucson', trim: 'SE' },
  { year: 2023, make: 'Hyundai', model: 'Tucson', trim: 'SEL' },
  { year: 2022, make: 'Hyundai', model: 'Tucson', trim: 'Limited' },
  { year: 2024, make: 'Nissan', model: 'Rogue', trim: 'S' },
  { year: 2023, make: 'Nissan', model: 'Rogue', trim: 'SV' },
  { year: 2022, make: 'Nissan', model: 'Rogue', trim: 'SL' },
  { year: 2024, make: 'Hyundai', model: 'Sonata', trim: 'SE' },
  { year: 2023, make: 'Kia', model: 'K5', trim: 'LXS' },
  { year: 2024, make: 'Nissan', model: 'Altima', trim: 'S' },
  { year: 2023, make: 'Volkswagen', model: 'Jetta', trim: 'S' },
  { year: 2024, make: 'Subaru', model: 'Outback', trim: 'Base' },
  { year: 2023, make: 'Subaru', model: 'Forester', trim: 'Base' },
  { year: 2024, make: 'Mazda', model: 'CX-30', trim: 'Base' },
  { year: 2023, make: 'Kia', model: 'Sportage', trim: 'LX' },
  { year: 2024, make: 'Hyundai', model: 'Santa Fe', trim: 'SE' },
  { year: 2023, make: 'Toyota', model: 'Corolla', trim: 'LE' },
  { year: 2024, make: 'Honda', model: 'HR-V', trim: 'LX' },
  { year: 2023, make: 'Mazda', model: 'Mazda3', trim: 'Base' },
  { year: 2024, make: 'Kia', model: 'Seltos', trim: 'LX' },
  { year: 2023, make: 'Nissan', model: 'Sentra', trim: 'S' },
];

// 30 SUVs (full-size)
const suvs = [
  { year: 2024, make: 'Chevrolet', model: 'Tahoe', trim: 'LS' },
  { year: 2023, make: 'Chevrolet', model: 'Tahoe', trim: 'LT' },
  { year: 2022, make: 'Chevrolet', model: 'Tahoe', trim: 'Premier' },
  { year: 2021, make: 'Chevrolet', model: 'Tahoe', trim: 'Z71' },
  { year: 2024, make: 'Chevrolet', model: 'Suburban', trim: 'LS' },
  { year: 2023, make: 'Chevrolet', model: 'Suburban', trim: 'LT' },
  { year: 2022, make: 'Chevrolet', model: 'Suburban', trim: 'Premier' },
  { year: 2024, make: 'Ford', model: 'Expedition', trim: 'XLT' },
  { year: 2023, make: 'Ford', model: 'Expedition', trim: 'Limited' },
  { year: 2022, make: 'Ford', model: 'Expedition', trim: 'King Ranch' },
  { year: 2024, make: 'Ford', model: 'Expedition Max', trim: 'XLT' },
  { year: 2024, make: 'GMC', model: 'Yukon', trim: 'SLE' },
  { year: 2023, make: 'GMC', model: 'Yukon', trim: 'SLT' },
  { year: 2022, make: 'GMC', model: 'Yukon', trim: 'Denali' },
  { year: 2024, make: 'GMC', model: 'Yukon XL', trim: 'SLE' },
  { year: 2023, make: 'GMC', model: 'Yukon XL', trim: 'Denali' },
  { year: 2024, make: 'Toyota', model: '4Runner', trim: 'SR5' },
  { year: 2023, make: 'Toyota', model: '4Runner', trim: 'TRD Off-Road' },
  { year: 2022, make: 'Toyota', model: '4Runner', trim: 'Limited' },
  { year: 2021, make: 'Toyota', model: '4Runner', trim: 'TRD Pro' },
  { year: 2024, make: 'Toyota', model: 'Highlander', trim: 'LE' },
  { year: 2023, make: 'Toyota', model: 'Highlander', trim: 'XLE' },
  { year: 2022, make: 'Toyota', model: 'Highlander', trim: 'Limited' },
  { year: 2024, make: 'Toyota', model: 'Sequoia', trim: 'SR5' },
  { year: 2023, make: 'Toyota', model: 'Sequoia', trim: 'Limited' },
  { year: 2024, make: 'Jeep', model: 'Grand Cherokee', trim: 'Laredo' },
  { year: 2023, make: 'Jeep', model: 'Grand Cherokee', trim: 'Limited' },
  { year: 2024, make: 'Dodge', model: 'Durango', trim: 'SXT' },
  { year: 2023, make: 'Nissan', model: 'Armada', trim: 'SV' },
  { year: 2024, make: 'Infiniti', model: 'QX80', trim: 'Luxe' },
];

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  staggeredCorrect: 0,
  staggeredTotal: 0,
  failures: [],
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testVehicle(vehicle, category) {
  const { year, make, model, trim } = vehicle;
  const label = `${year} ${make} ${model} ${trim}`;
  results.total++;
  
  try {
    // Test wheel fitment API
    const wheelUrl = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}&page=1&pageSize=1`;
    const wheelRes = await fetch(wheelUrl);
    
    if (!wheelRes.ok) {
      throw new Error(`Wheel API returned ${wheelRes.status}`);
    }
    
    const wheelData = await wheelRes.json();
    
    // Check for isStaggered flag
    const isStaggered = wheelData.isStaggered || false;
    const frontSize = wheelData.frontWheelSize;
    const rearSize = wheelData.rearWheelSize;
    
    if (category === 'staggered') {
      results.staggeredTotal++;
      // Staggered vehicles should have isStaggered=true OR different front/rear sizes
      if (isStaggered || (frontSize && rearSize && frontSize !== rearSize)) {
        results.staggeredCorrect++;
      }
    }
    
    // Test tire API
    const tireUrl = `${BASE_URL}/api/tires/search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}&page=1&pageSize=1`;
    const tireRes = await fetch(tireUrl);
    
    if (!tireRes.ok) {
      throw new Error(`Tire API returned ${tireRes.status}`);
    }
    
    const tireData = await tireRes.json();
    
    // Verify we got some results
    const hasWheels = wheelData.wheels?.length > 0 || wheelData.products?.length > 0 || wheelData.totalCount > 0;
    const hasTires = tireData.tires?.length > 0 || tireData.products?.length > 0 || tireData.totalCount > 0;
    
    if (!hasWheels && !hasTires) {
      throw new Error('No wheels or tires returned');
    }
    
    results.passed++;
    const staggeredInfo = category === 'staggered' ? ` [staggered=${isStaggered}, front=${frontSize || 'N/A'}, rear=${rearSize || 'N/A'}]` : '';
    console.log(`✅ ${label}${staggeredInfo}`);
    
  } catch (err) {
    results.failed++;
    results.failures.push({ vehicle: label, category, error: err.message });
    console.log(`❌ ${label}: ${err.message}`);
  }
}

async function runBatch() {
  console.log('='.repeat(60));
  console.log('QA BATCH 4 - Staggered/Performance + Passenger + SUVs');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('='.repeat(60));
  console.log('');
  
  // Test staggered performance cars
  console.log('--- STAGGERED PERFORMANCE CARS (30) ---');
  for (const v of staggeredPerformance) {
    await testVehicle(v, 'staggered');
    await sleep(200); // Rate limiting
  }
  console.log('');
  
  // Test passenger cars
  console.log('--- PASSENGER SEDANS/CROSSOVERS (40) ---');
  for (const v of passengerCars) {
    await testVehicle(v, 'passenger');
    await sleep(200);
  }
  console.log('');
  
  // Test SUVs
  console.log('--- FULL-SIZE SUVS (30) ---');
  for (const v of suvs) {
    await testVehicle(v, 'suv');
    await sleep(200);
  }
  console.log('');
  
  // Summary
  console.log('='.repeat(60));
  console.log('BATCH 4 RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tested:    ${results.total}`);
  console.log(`Passed:          ${results.passed}`);
  console.log(`Failed:          ${results.failed}`);
  console.log(`Pass Rate:       ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('');
  console.log(`Staggered Detection:`);
  console.log(`  Tested:        ${results.staggeredTotal}`);
  console.log(`  Correct:       ${results.staggeredCorrect}`);
  console.log(`  Accuracy:      ${results.staggeredTotal > 0 ? ((results.staggeredCorrect / results.staggeredTotal) * 100).toFixed(1) : 0}%`);
  console.log('');
  
  if (results.failures.length > 0) {
    console.log('FAILURES:');
    for (const f of results.failures) {
      console.log(`  - [${f.category}] ${f.vehicle}: ${f.error}`);
    }
  }
  
  console.log('='.repeat(60));
}

runBatch().catch(console.error);
