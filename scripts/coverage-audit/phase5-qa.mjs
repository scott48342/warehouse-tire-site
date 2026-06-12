/**
 * Phase 5: Post-Import QA
 * 
 * Automated tests for each imported vehicle:
 * - Vehicle lookup
 * - Wheel search
 * - Tire search
 * - Package generation
 * 
 * @created 2026-06-12
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';
const OUTPUT_DIR = './scripts/coverage-audit/reports';

// ═══════════════════════════════════════════════════════════════════════════════
// QA TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function testVehicleLookup(year, make, model) {
  try {
    // Check if model appears in API
    const url = `${BASE_URL}/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`;
    const res = await fetch(url);
    if (!res.ok) return { pass: false, error: `API error: ${res.status}` };
    
    const data = await res.json();
    const found = data.results?.some(m => 
      m.toLowerCase().replace(/[^a-z0-9]/g, '') === model.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    
    return { pass: found, error: found ? null : 'Model not found in API' };
  } catch (err) {
    return { pass: false, error: err.message };
  }
}

async function testTrimLookup(year, make, model) {
  try {
    const url = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const res = await fetch(url);
    if (!res.ok) return { pass: false, error: `API error: ${res.status}` };
    
    const data = await res.json();
    const hasTrims = data.trims?.length > 0 || data.results?.length > 0;
    
    return { 
      pass: hasTrims, 
      error: hasTrims ? null : 'No trims returned',
      trimCount: data.trims?.length || data.results?.length || 0,
    };
  } catch (err) {
    return { pass: false, error: err.message };
  }
}

async function testWheelSearch(year, make, model) {
  try {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const res = await fetch(url);
    if (!res.ok) return { pass: false, error: `API error: ${res.status}` };
    
    const data = await res.json();
    const hasWheels = data.wheels?.length > 0 || data.results?.length > 0;
    
    return { 
      pass: hasWheels, 
      error: hasWheels ? null : 'No wheels returned',
      wheelCount: data.wheels?.length || data.results?.length || 0,
      fitmentResolved: !!data.fitment,
    };
  } catch (err) {
    return { pass: false, error: err.message };
  }
}

async function testTireSearch(year, make, model) {
  try {
    const url = `${BASE_URL}/api/tires/search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const res = await fetch(url);
    if (!res.ok) return { pass: false, error: `API error: ${res.status}` };
    
    const data = await res.json();
    const hasTires = data.tires?.length > 0 || data.results?.length > 0;
    
    return { 
      pass: hasTires, 
      error: hasTires ? null : 'No tires returned',
      tireCount: data.tires?.length || data.results?.length || 0,
    };
  } catch (err) {
    return { pass: false, error: err.message };
  }
}

async function testFitmentSpecs(year, make, model, expectedBolt) {
  try {
    const url = `${BASE_URL}/api/public/fitment/specs?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const res = await fetch(url);
    if (!res.ok) return { pass: false, error: `API error: ${res.status}` };
    
    const data = await res.json();
    
    if (!data.specs) {
      return { pass: false, error: 'No specs returned' };
    }
    
    // Verify bolt pattern matches
    const actualBolt = data.specs.boltPattern;
    const boltMatch = actualBolt === expectedBolt;
    
    return { 
      pass: boltMatch, 
      error: boltMatch ? null : `Bolt mismatch: expected ${expectedBolt}, got ${actualBolt}`,
      specs: data.specs,
    };
  } catch (err) {
    return { pass: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN QA RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runQA() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('WTD POST-IMPORT QA - Phase 5');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);
  
  // Load validated imports
  const importPath = path.join(OUTPUT_DIR, 'validated-imports.json');
  if (!fs.existsSync(importPath)) {
    console.error('No import data found!');
    process.exit(1);
  }
  
  const importData = JSON.parse(fs.readFileSync(importPath, 'utf-8'));
  
  // Group by vehicle for cleaner output
  const grouped = {};
  for (const r of importData.records) {
    const key = `${r.make}:${r.model}`;
    if (!grouped[key]) {
      grouped[key] = {
        make: r.make,
        model: r.model,
        boltPattern: r.boltPattern,
        years: [],
      };
    }
    grouped[key].years.push(r.year);
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passed: 0,
    failed: 0,
    vehicles: [],
  };
  
  console.log(`\nTesting ${Object.keys(grouped).length} vehicles...\n`);
  
  for (const [key, vehicle] of Object.entries(grouped)) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${vehicle.make} ${vehicle.model}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const vehicleResults = {
      make: vehicle.make,
      model: vehicle.model,
      years: vehicle.years,
      tests: [],
    };
    
    // Test one year per vehicle (most recent)
    const testYear = Math.max(...vehicle.years);
    console.log(`  Testing year: ${testYear}`);
    
    // Test 1: Vehicle Lookup
    const lookupResult = await testVehicleLookup(testYear, vehicle.make, vehicle.model);
    vehicleResults.tests.push({ name: 'Vehicle Lookup', ...lookupResult });
    results.totalTests++;
    if (lookupResult.pass) results.passed++; else results.failed++;
    console.log(`  ${lookupResult.pass ? '✓' : '✗'} Vehicle Lookup: ${lookupResult.pass ? 'PASS' : lookupResult.error}`);
    
    // Test 2: Trim Lookup
    const trimResult = await testTrimLookup(testYear, vehicle.make, vehicle.model);
    vehicleResults.tests.push({ name: 'Trim Lookup', ...trimResult });
    results.totalTests++;
    if (trimResult.pass) results.passed++; else results.failed++;
    console.log(`  ${trimResult.pass ? '✓' : '✗'} Trim Lookup: ${trimResult.pass ? `PASS (${trimResult.trimCount} trims)` : trimResult.error}`);
    
    // Test 3: Fitment Specs
    const specsResult = await testFitmentSpecs(testYear, vehicle.make, vehicle.model, vehicle.boltPattern);
    vehicleResults.tests.push({ name: 'Fitment Specs', ...specsResult });
    results.totalTests++;
    if (specsResult.pass) results.passed++; else results.failed++;
    console.log(`  ${specsResult.pass ? '✓' : '✗'} Fitment Specs: ${specsResult.pass ? `PASS (${vehicle.boltPattern})` : specsResult.error}`);
    
    // Test 4: Wheel Search
    const wheelResult = await testWheelSearch(testYear, vehicle.make, vehicle.model);
    vehicleResults.tests.push({ name: 'Wheel Search', ...wheelResult });
    results.totalTests++;
    if (wheelResult.pass) results.passed++; else results.failed++;
    console.log(`  ${wheelResult.pass ? '✓' : '✗'} Wheel Search: ${wheelResult.pass ? `PASS (${wheelResult.wheelCount} wheels)` : wheelResult.error}`);
    
    // Test 5: Tire Search
    const tireResult = await testTireSearch(testYear, vehicle.make, vehicle.model);
    vehicleResults.tests.push({ name: 'Tire Search', ...tireResult });
    results.totalTests++;
    if (tireResult.pass) results.passed++; else results.failed++;
    console.log(`  ${tireResult.pass ? '✓' : '✗'} Tire Search: ${tireResult.pass ? `PASS (${tireResult.tireCount} tires)` : tireResult.error}`);
    
    results.vehicles.push(vehicleResults);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Save results
  const qaPath = path.join(OUTPUT_DIR, `qa-results-${Date.now()}.json`);
  fs.writeFileSync(qaPath, JSON.stringify(results, null, 2));
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('QA SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Passed: ${results.passed} (${Math.round(results.passed / results.totalTests * 100)}%)`);
  console.log(`Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    console.log('\n⚠️  FAILED TESTS:');
    for (const v of results.vehicles) {
      const failures = v.tests.filter(t => !t.pass);
      if (failures.length > 0) {
        console.log(`  ${v.make} ${v.model}:`);
        for (const f of failures) {
          console.log(`    ✗ ${f.name}: ${f.error}`);
        }
      }
    }
  }
  
  console.log(`\nFull results saved to: ${qaPath}`);
  
  return results;
}

runQA().catch(err => {
  console.error('QA failed:', err);
  process.exit(1);
});
