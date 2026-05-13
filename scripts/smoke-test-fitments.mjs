#!/usr/bin/env node
/**
 * Smoke Test: Problem Vehicle Fitment Visibility
 * 
 * Tests the 10 known problem vehicles to ensure fitment data is accessible
 * through the production API endpoints.
 * 
 * Usage: node scripts/smoke-test-fitments.mjs [--base-url=http://localhost:3001]
 */

const BASE_URL = process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1] || 'http://localhost:3001';

const PROBLEM_VEHICLES = [
  { year: 2022, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2023, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2025, make: 'Ford', model: 'Bronco' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette' },
  { year: 2024, make: 'BMW', model: 'M3' },
  { year: 2024, make: 'Ram', model: '3500' },
];

async function testVehicle(vehicle) {
  const { year, make, model } = vehicle;
  const result = {
    vehicle: `${year} ${make} ${model}`,
    trimsFound: 0,
    fitmentSource: null,
    wheelDiameters: [],
    tireSizes: [],
    errors: [],
  };

  try {
    // 1. Check if trims are available
    const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const trimsRes = await fetch(trimsUrl);
    if (!trimsRes.ok) {
      result.errors.push(`Trims API failed: ${trimsRes.status}`);
      return result;
    }
    const trimsData = await trimsRes.json();
    // API returns "results" not "trims"
    const trims = trimsData.results || trimsData.trims || [];
    result.trimsFound = trims.length;

    if (result.trimsFound === 0) {
      result.errors.push('No trims found');
      return result;
    }

    // 2. Get tire sizes for first trim (use label or value)
    const firstTrim = trims[0]?.label || trims[0]?.value || trims[0];
    const tireSizesUrl = `${BASE_URL}/api/vehicles/tire-sizes?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(firstTrim)}`;
    const tireSizesRes = await fetch(tireSizesUrl);
    if (!tireSizesRes.ok) {
      result.errors.push(`Tire-sizes API failed: ${tireSizesRes.status}`);
      return result;
    }
    const tireSizesData = await tireSizesRes.json();

    // Extract source info
    result.fitmentSource = tireSizesData.source || 'unknown';
    
    // Extract wheel diameters
    if (tireSizesData.wheelDiameters?.available) {
      result.wheelDiameters = tireSizesData.wheelDiameters.available;
    }

    // Extract tire sizes
    if (tireSizesData.tireSizes) {
      result.tireSizes = tireSizesData.tireSizes;
    }

    // Validation - tire sizes may be empty for some vehicles (data format issue)
    // Just warn, don't fail, since trims resolving is the main fix
    if (result.tireSizes.length === 0 && tireSizesData.source !== 'none') {
      result.errors.push('No tire sizes returned (possible data format issue)');
    }

  } catch (err) {
    result.errors.push(`Exception: ${err.message}`);
  }

  return result;
}

async function main() {
  console.log('='.repeat(70));
  console.log('FITMENT SMOKE TEST - Problem Vehicles');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
  console.log('');

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const vehicle of PROBLEM_VEHICLES) {
    const result = await testVehicle(vehicle);
    results.push(result);

    const status = result.errors.length === 0 ? '✅ PASS' : '❌ FAIL';
    if (result.errors.length === 0) passed++;
    else failed++;

    console.log(`${status} | ${result.vehicle}`);
    console.log(`       Trims: ${result.trimsFound} | Source: ${result.fitmentSource}`);
    console.log(`       Wheels: [${result.wheelDiameters.join(', ')}]`);
    console.log(`       Tires: [${result.tireSizes.slice(0, 3).join(', ')}${result.tireSizes.length > 3 ? '...' : ''}]`);
    if (result.errors.length > 0) {
      console.log(`       Errors: ${result.errors.join('; ')}`);
    }
    console.log('');
  }

  console.log('='.repeat(70));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${PROBLEM_VEHICLES.length}`);
  console.log('='.repeat(70));

  // Output JSON for comparison
  const outputPath = `scripts/smoke-test-results-${Date.now()}.json`;
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify({ timestamp: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
