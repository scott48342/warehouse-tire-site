#!/usr/bin/env node
/**
 * Production Smoke Test: fix/package-offset-defaults
 */

const PROD_URL = 'https://shop.warehousetiredirect.com';

const SMOKE_TESTS = [
  { year: 2024, make: 'Toyota', model: 'Camry', expect: { min: 2, type: 'modern' } },
  { year: 2024, make: 'Ford', model: 'F-150', expect: { min: 2, type: 'truck' } },
  { year: 2024, make: 'BMW', model: 'X3', expect: { min: 1, type: 'suv' } },
  { year: 2018, make: 'Alfa Romeo', model: 'Giulia', expect: { min: 1, type: 'modern' } },
  { year: 1970, make: 'Chevrolet', model: 'Chevelle', expect: { min: 1, type: 'classic' } },
];

async function testVehicle(vehicle) {
  const params = new URLSearchParams({
    year: vehicle.year.toString(),
    make: vehicle.make,
    model: vehicle.model,
  });
  
  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  try {
    const response = await fetch(`${PROD_URL}/api/packages/recommended?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { label, status: 'FAIL', reason: `HTTP ${response.status}: ${text.slice(0, 100)}` };
    }
    
    const data = await response.json();
    const count = data.packages?.length || 0;
    const offsets = (data.packages || []).map(p => p.wheel?.offset).filter(o => o !== undefined);
    
    if (count < vehicle.expect.min) {
      return { label, status: 'FAIL', reason: `Only ${count} packages (expected ≥${vehicle.expect.min})`, count, offsets };
    }
    
    // Check for invalid fitment
    const invalidFitments = (data.packages || []).filter(p => !p.fitmentValidation?.safe);
    if (invalidFitments.length > 0) {
      return { label, status: 'WARN', reason: `${invalidFitments.length} packages have fitment warnings`, count, offsets };
    }
    
    return { label, status: 'PASS', count, offsets, type: vehicle.expect.type };
    
  } catch (err) {
    return { label, status: 'FAIL', reason: err.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('PRODUCTION SMOKE TEST');
  console.log(`Target: ${PROD_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const vehicle of SMOKE_TESTS) {
    const result = await testVehicle(vehicle);
    
    if (result.status === 'PASS') {
      console.log(`✅ ${result.label}: ${result.count} packages (offsets: ${result.offsets.join(', ')})`);
      passed++;
    } else if (result.status === 'WARN') {
      console.log(`⚠️  ${result.label}: ${result.reason}`);
      passed++; // warnings count as pass
    } else {
      console.log(`❌ ${result.label}: ${result.reason}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('\n✅ SMOKE TEST PASSED - Deployment successful');
  } else {
    console.log('\n❌ SMOKE TEST FAILED - Review required');
    process.exit(1);
  }
}

main().catch(console.error);
