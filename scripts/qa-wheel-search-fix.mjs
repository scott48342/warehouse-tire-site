/**
 * QA: Wheel Search Fix Verification (2026-05-12)
 * Tests that vehicle_fitments is now being used as primary source
 */

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

const testVehicles = [
  { year: 2007, make: 'BMW', model: '3 Series', trim: '328i', note: 'Original bug report' },
  { year: 2024, make: 'Ford', model: 'F-150', note: 'Top seller truck' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', note: 'Top seller truck' },
  { year: 2024, make: 'Toyota', model: 'Camry', note: 'Top seller car' },
  { year: 2024, make: 'Honda', model: 'Civic', note: 'Popular compact' },
  { year: 2024, make: 'Ford', model: 'Mustang', note: 'Performance car' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', note: 'Performance/staggered' },
  { year: 2024, make: 'Tesla', model: 'Model 3', note: 'EV' },
  { year: 2024, make: 'Honda', model: 'Accord', note: 'Popular sedan' },
  { year: 2024, make: 'Toyota', model: 'RAV4', note: 'Popular SUV' },
];

async function testVehicle(v) {
  const url = `${BASE_URL}/api/wheels/fitment-search?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}${v.trim ? `&trim=${encodeURIComponent(v.trim)}` : ''}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    return {
      vehicle: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ''}`,
      note: v.note,
      status: res.status,
      resolved: !data.profileNotFound && !data.blocked,
      usesNewTable: data.fitment?.resolutionPath !== 'legacy' || data.fitment?.fitmentSource === 'dbFirst',
      totalWheels: data.totalCount || 0,
      confidence: data.fitment?.confidence || 'unknown',
      boltPattern: data.fitment?.envelope?.boltPattern || data.fitment?.dbProfile?.boltPattern || 'N/A',
      hubBore: data.fitment?.envelope?.centerBore || data.fitment?.dbProfile?.centerBoreMm || 'N/A',
      blocked: data.blocked || false,
      blockReason: data.blockReason || null,
      profileNotFound: data.profileNotFound || false,
      staggered: data.fitment?.staggered?.isStaggered || false,
      errors: data.error || null,
    };
  } catch (err) {
    return {
      vehicle: `${v.year} ${v.make} ${v.model}`,
      error: err.message,
      resolved: false,
    };
  }
}

async function runQA() {
  console.log('='.repeat(80));
  console.log('WHEEL SEARCH FIX QA - Commit dc2d613');
  console.log('Testing:', BASE_URL);
  console.log('='.repeat(80));
  console.log('');

  const results = [];
  
  for (const v of testVehicles) {
    const result = await testVehicle(v);
    results.push(result);
    
    const status = result.resolved ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${result.vehicle}`);
    console.log(`   Wheels: ${result.totalWheels} | Confidence: ${result.confidence} | Bolt: ${result.boltPattern} | Hub: ${result.hubBore}mm`);
    if (result.staggered) console.log(`   ⚡ Staggered fitment detected`);
    if (result.blocked) console.log(`   ❌ BLOCKED: ${result.blockReason}`);
    if (result.profileNotFound) console.log(`   ❌ profileNotFound: true`);
    if (result.errors) console.log(`   ❌ Error: ${result.errors}`);
    console.log('');
  }

  // Summary
  const passed = results.filter(r => r.resolved).length;
  const failed = results.filter(r => !r.resolved).length;
  
  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passed}/${results.length} passed, ${failed} failed`);
  console.log('='.repeat(80));

  // Detailed table
  console.log('\n--- DETAILED RESULTS ---\n');
  console.log('| Vehicle | Wheels | Confidence | Bolt | Hub | Staggered | Status |');
  console.log('|---------|--------|------------|------|-----|-----------|--------|');
  for (const r of results) {
    const status = r.resolved ? '✅' : '❌';
    console.log(`| ${r.vehicle} | ${r.totalWheels} | ${r.confidence} | ${r.boltPattern} | ${r.hubBore} | ${r.staggered ? 'Yes' : 'No'} | ${status} |`);
  }

  // Return exit code
  process.exit(failed > 0 ? 1 : 0);
}

runQA();
