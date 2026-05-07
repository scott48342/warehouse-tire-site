// QA Batch 3 - HD Trucks, Half-Ton Lifted, Midsize Trucks
// Testing wheel fitment and tire search APIs against production

const BASE_URL = 'https://shop.warehousetiredirect.com';

// Test vehicle definitions
const vehicles = {
  hdTrucks: [
    // Ford F-250/F-350
    { year: 2024, make: 'Ford', model: 'F-250', trim: 'XLT' },
    { year: 2024, make: 'Ford', model: 'F-250', trim: 'Lariat' },
    { year: 2024, make: 'Ford', model: 'F-350', trim: 'XLT' },
    { year: 2024, make: 'Ford', model: 'F-350', trim: 'Lariat' },
    { year: 2023, make: 'Ford', model: 'F-250', trim: 'XLT' },
    { year: 2022, make: 'Ford', model: 'F-350', trim: 'Platinum' },
    // Chevy Silverado 2500/3500
    { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT' },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'High Country' },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 3500 HD', trim: 'LT' },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 3500 HD', trim: 'High Country' },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LTZ' },
    { year: 2022, make: 'Chevrolet', model: 'Silverado 3500 HD', trim: 'LTZ' },
    // Ram 2500/3500
    { year: 2024, make: 'Ram', model: '2500', trim: 'Big Horn' },
    { year: 2024, make: 'Ram', model: '2500', trim: 'Laramie' },
    { year: 2024, make: 'Ram', model: '3500', trim: 'Big Horn' },
    { year: 2024, make: 'Ram', model: '3500', trim: 'Laramie' },
    { year: 2023, make: 'Ram', model: '2500', trim: 'Longhorn' },
    { year: 2022, make: 'Ram', model: '3500', trim: 'Limited' },
    // GMC Sierra 2500/3500
    { year: 2024, make: 'GMC', model: 'Sierra 2500 HD', trim: 'SLE' },
    { year: 2024, make: 'GMC', model: 'Sierra 2500 HD', trim: 'Denali' },
    { year: 2024, make: 'GMC', model: 'Sierra 3500 HD', trim: 'SLT' },
    { year: 2024, make: 'GMC', model: 'Sierra 3500 HD', trim: 'Denali' },
    { year: 2023, make: 'GMC', model: 'Sierra 2500 HD', trim: 'AT4' },
    { year: 2022, make: 'GMC', model: 'Sierra 3500 HD', trim: 'AT4' },
    // Older HD trucks
    { year: 2020, make: 'Ford', model: 'F-250', trim: 'XLT' },
    { year: 2019, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT' },
    { year: 2018, make: 'Ram', model: '2500', trim: 'Laramie' },
    { year: 2017, make: 'GMC', model: 'Sierra 2500 HD', trim: 'SLT' },
    { year: 2016, make: 'Ford', model: 'F-350', trim: 'Lariat' },
    { year: 2015, make: 'Chevrolet', model: 'Silverado 3500 HD', trim: 'LTZ' },
  ],
  halfTonLifted: [
    // Ford F-150 with various lift configs
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', liftHeight: 2 },
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', liftHeight: 4 },
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', liftHeight: 6 },
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'Lariat', liftHeight: 2 },
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'Lariat', liftHeight: 4 },
    { year: 2023, make: 'Ford', model: 'F-150', trim: 'XLT', liftHeight: 3 },
    { year: 2023, make: 'Ford', model: 'F-150', trim: 'Platinum', liftHeight: 6 },
    { year: 2022, make: 'Ford', model: 'F-150', trim: 'XLT', liftHeight: 4 },
    { year: 2021, make: 'Ford', model: 'F-150', trim: 'Lariat', liftHeight: 6 },
    { year: 2020, make: 'Ford', model: 'F-150', trim: 'XLT', liftHeight: 4 },
    // Chevy Silverado 1500
    { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', liftHeight: 2 },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', liftHeight: 4 },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', liftHeight: 6 },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'RST', liftHeight: 4 },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LTZ', liftHeight: 3 },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 1500', trim: 'High Country', liftHeight: 6 },
    { year: 2022, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT Trail Boss', liftHeight: 4 },
    { year: 2021, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', liftHeight: 6 },
    { year: 2020, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', liftHeight: 4 },
    { year: 2019, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', liftHeight: 6 },
    // Ram 1500
    { year: 2024, make: 'Ram', model: '1500', trim: 'Big Horn', liftHeight: 2 },
    { year: 2024, make: 'Ram', model: '1500', trim: 'Big Horn', liftHeight: 4 },
    { year: 2024, make: 'Ram', model: '1500', trim: 'Laramie', liftHeight: 6 },
    { year: 2024, make: 'Ram', model: '1500', trim: 'Rebel', liftHeight: 4 },
    { year: 2023, make: 'Ram', model: '1500', trim: 'Big Horn', liftHeight: 3 },
    { year: 2023, make: 'Ram', model: '1500', trim: 'Longhorn', liftHeight: 6 },
    { year: 2022, make: 'Ram', model: '1500', trim: 'Laramie', liftHeight: 4 },
    { year: 2021, make: 'Ram', model: '1500', trim: 'Big Horn', liftHeight: 6 },
    { year: 2020, make: 'Ram', model: '1500', trim: 'Rebel', liftHeight: 4 },
    { year: 2019, make: 'Ram', model: '1500', trim: 'Big Horn', liftHeight: 6 },
    // Toyota Tundra
    { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'SR5', liftHeight: 2 },
    { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'SR5', liftHeight: 4 },
    { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'Limited', liftHeight: 6 },
    { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'TRD Pro', liftHeight: 3 },
    { year: 2023, make: 'Toyota', model: 'Tundra', trim: 'SR5', liftHeight: 4 },
    { year: 2023, make: 'Toyota', model: 'Tundra', trim: 'Platinum', liftHeight: 6 },
    { year: 2022, make: 'Toyota', model: 'Tundra', trim: 'Limited', liftHeight: 4 },
    { year: 2021, make: 'Toyota', model: 'Tundra', trim: 'SR5', liftHeight: 6 },
    { year: 2020, make: 'Toyota', model: 'Tundra', trim: 'SR5', liftHeight: 4 },
    { year: 2019, make: 'Toyota', model: 'Tundra', trim: 'TRD Pro', liftHeight: 3 },
  ],
  midsizeTrucks: [
    // Toyota Tacoma
    { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'SR5' },
    { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Sport' },
    { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Off-Road' },
    { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Pro' },
    { year: 2023, make: 'Toyota', model: 'Tacoma', trim: 'SR5' },
    { year: 2022, make: 'Toyota', model: 'Tacoma', trim: 'TRD Sport' },
    { year: 2021, make: 'Toyota', model: 'Tacoma', trim: 'TRD Off-Road' },
    { year: 2020, make: 'Toyota', model: 'Tacoma', trim: 'Limited' },
    // Ford Ranger
    { year: 2024, make: 'Ford', model: 'Ranger', trim: 'XLT' },
    { year: 2024, make: 'Ford', model: 'Ranger', trim: 'Lariat' },
    { year: 2024, make: 'Ford', model: 'Ranger', trim: 'Raptor' },
    { year: 2023, make: 'Ford', model: 'Ranger', trim: 'XLT' },
    { year: 2022, make: 'Ford', model: 'Ranger', trim: 'Lariat' },
    { year: 2021, make: 'Ford', model: 'Ranger', trim: 'XL' },
    { year: 2020, make: 'Ford', model: 'Ranger', trim: 'XLT' },
    // Chevy Colorado
    { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'LT' },
    { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'Z71' },
    { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'ZR2' },
    { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'Trail Boss' },
    { year: 2023, make: 'Chevrolet', model: 'Colorado', trim: 'LT' },
    { year: 2022, make: 'Chevrolet', model: 'Colorado', trim: 'Z71' },
    { year: 2021, make: 'Chevrolet', model: 'Colorado', trim: 'ZR2' },
    // Nissan Frontier
    { year: 2024, make: 'Nissan', model: 'Frontier', trim: 'SV' },
    { year: 2024, make: 'Nissan', model: 'Frontier', trim: 'PRO-X' },
    { year: 2024, make: 'Nissan', model: 'Frontier', trim: 'PRO-4X' },
    { year: 2023, make: 'Nissan', model: 'Frontier', trim: 'SV' },
    { year: 2022, make: 'Nissan', model: 'Frontier', trim: 'PRO-4X' },
    { year: 2021, make: 'Nissan', model: 'Frontier', trim: 'SV' },
    { year: 2020, make: 'Nissan', model: 'Frontier', trim: 'PRO-4X' },
    { year: 2019, make: 'Nissan', model: 'Frontier', trim: 'SV' },
  ]
};

// Results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  criticalFailures: [],
  details: []
};

async function testWheelFitment(vehicle) {
  const params = new URLSearchParams({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
  });
  if (vehicle.trim) params.append('trim', vehicle.trim);
  if (vehicle.liftHeight) params.append('liftHeight', vehicle.liftHeight);
  
  const url = `${BASE_URL}/api/wheels/fitment-search?${params}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, data };
    }
    
    // Check for valid wheel results
    if (data.wheels && data.wheels.length > 0) {
      return { success: true, wheelCount: data.wheels.length, isStaggered: data.isStaggered };
    } else if (data.error) {
      return { success: false, error: data.error };
    } else {
      return { success: false, error: 'No wheels returned', data };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function testTireSearch(vehicle, wheelDiameter = 20) {
  const params = new URLSearchParams({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    wheelDiameter: wheelDiameter,
  });
  if (vehicle.trim) params.append('trim', vehicle.trim);
  if (vehicle.liftHeight) params.append('liftHeight', vehicle.liftHeight);
  
  const url = `${BASE_URL}/api/tires/search?${params}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, data };
    }
    
    // Check for valid tire results
    if (data.tires && data.tires.length > 0) {
      return { success: true, tireCount: data.tires.length };
    } else if (data.error) {
      return { success: false, error: data.error };
    } else {
      return { success: false, error: 'No tires returned', data };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function testVehicle(vehicle, category) {
  const vehicleId = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}${vehicle.liftHeight ? ` (${vehicle.liftHeight}" lift)` : ''}`.trim();
  
  const wheelResult = await testWheelFitment(vehicle);
  const tireResult = await testTireSearch(vehicle);
  
  const passed = wheelResult.success && tireResult.success;
  
  const detail = {
    vehicle: vehicleId,
    category,
    wheelFitment: wheelResult,
    tireSearch: tireResult,
    passed
  };
  
  results.details.push(detail);
  results.total++;
  
  if (passed) {
    results.passed++;
    process.stdout.write('.');
  } else {
    results.failed++;
    process.stdout.write('F');
    
    // Critical failure if both APIs fail
    if (!wheelResult.success && !tireResult.success) {
      results.criticalFailures.push({
        vehicle: vehicleId,
        wheelError: wheelResult.error,
        tireError: tireResult.error
      });
    }
  }
  
  return detail;
}

async function runBatch(vehicleList, category) {
  console.log(`\n\nTesting ${category} (${vehicleList.length} vehicles):`);
  
  for (const vehicle of vehicleList) {
    await testVehicle(vehicle, category);
    // Small delay to avoid overwhelming the server
    await new Promise(r => setTimeout(r, 100));
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('QA Batch 3 - HD Trucks, Half-Ton Lifted, Midsize Trucks');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  await runBatch(vehicles.hdTrucks, 'HD Trucks');
  await runBatch(vehicles.halfTonLifted, 'Half-Ton Lifted');
  await runBatch(vehicles.midsizeTrucks, 'Midsize Trucks');
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tested: ${results.total}`);
  console.log(`Passed: ${results.passed} (${((results.passed/results.total)*100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed} (${((results.failed/results.total)*100).toFixed(1)}%)`);
  console.log(`Time: ${elapsed}s`);
  
  if (results.criticalFailures.length > 0) {
    console.log('\n' + '!'.repeat(60));
    console.log(`CRITICAL FAILURES (${results.criticalFailures.length}):`);
    console.log('!'.repeat(60));
    for (const cf of results.criticalFailures) {
      console.log(`  - ${cf.vehicle}`);
      console.log(`    Wheel: ${cf.wheelError}`);
      console.log(`    Tire: ${cf.tireError}`);
    }
  }
  
  // Show failed tests by category
  const failedByCategory = {};
  for (const detail of results.details) {
    if (!detail.passed) {
      if (!failedByCategory[detail.category]) {
        failedByCategory[detail.category] = [];
      }
      failedByCategory[detail.category].push(detail);
    }
  }
  
  if (Object.keys(failedByCategory).length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('FAILED TESTS BY CATEGORY:');
    console.log('-'.repeat(60));
    
    for (const [category, failures] of Object.entries(failedByCategory)) {
      console.log(`\n${category} (${failures.length} failures):`);
      for (const f of failures.slice(0, 10)) { // Show first 10
        const wheelStatus = f.wheelFitment.success ? `✓ ${f.wheelFitment.wheelCount} wheels` : `✗ ${f.wheelFitment.error}`;
        const tireStatus = f.tireSearch.success ? `✓ ${f.tireSearch.tireCount} tires` : `✗ ${f.tireSearch.error}`;
        console.log(`  ${f.vehicle}`);
        console.log(`    Wheels: ${wheelStatus}`);
        console.log(`    Tires: ${tireStatus}`);
      }
      if (failures.length > 10) {
        console.log(`  ... and ${failures.length - 10} more`);
      }
    }
  }
  
  // Write detailed results to file
  const outputPath = `./scripts/qa-sweep/results-prisma/batch-3-results.json`;
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${outputPath}`);
}

main().catch(console.error);
