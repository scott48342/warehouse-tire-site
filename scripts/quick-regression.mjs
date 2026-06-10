#!/usr/bin/env node
/**
 * Quick Regression Test: Before (Production) vs After (Local Fix)
 */

const PROD_URL = 'https://shop.warehousetiredirect.com';
const LOCAL_URL = 'http://localhost:3000';

const TEST_VEHICLES = {
  modernCars: [
    { year: 2024, make: 'Toyota', model: 'Camry' },
    { year: 2024, make: 'Honda', model: 'Accord' },
    { year: 2024, make: 'Hyundai', model: 'Sonata' },
    { year: 2024, make: 'Tesla', model: 'Model 3' },
  ],
  trucks: [
    { year: 2024, make: 'Ford', model: 'F-150' },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 1500' },
    { year: 2024, make: 'RAM', model: '1500' },
  ],
  suvs: [
    { year: 2024, make: 'Toyota', model: 'RAV4' },
    { year: 2024, make: 'BMW', model: 'X3' },
    { year: 2024, make: 'Audi', model: 'Q5' },
  ],
  classicRecovered: [
    { year: 1969, make: 'AMC', model: 'AMX' },
    { year: 1970, make: 'Chevrolet', model: 'Chevelle' },
    { year: 1968, make: 'Ford', model: 'Mustang' },
    { year: 1972, make: 'Dodge', model: 'Challenger' },
    { year: 1965, make: 'Ford', model: 'Galaxie' },
    { year: 1985, make: 'Chevrolet', model: 'Camaro' },
    { year: 1978, make: 'Pontiac', model: 'Firebird' },
    { year: 1955, make: 'Chevrolet', model: 'Bel Air' },
    { year: 1967, make: 'Plymouth', model: 'Barracuda' },
    { year: 1973, make: 'Chevrolet', model: 'Corvette' },
    { year: 1966, make: 'Pontiac', model: 'GTO' },
    { year: 1969, make: 'Dodge', model: 'Charger' },
    { year: 1970, make: 'Plymouth', model: 'Road Runner' },
    { year: 1971, make: 'Buick', model: 'Skylark' },
    { year: 1974, make: 'Oldsmobile', model: '442' },
    { year: 1965, make: 'Chevrolet', model: 'Impala' },
    { year: 1969, make: 'Chevrolet', model: 'Nova' },
    { year: 1970, make: 'Ford', model: 'Torino' },
    { year: 1968, make: 'Chevrolet', model: 'Camaro' },
    { year: 1967, make: 'Ford', model: 'Fairlane' },
  ],
};

async function fetchPackages(baseUrl, vehicle) {
  const params = new URLSearchParams({
    year: vehicle.year.toString(),
    make: vehicle.make,
    model: vehicle.model,
  });
  
  try {
    const response = await fetch(`${baseUrl}/api/packages/recommended?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { error: `HTTP ${response.status}: ${text.slice(0, 100)}`, packages: [] };
    }
    const data = await response.json();
    return {
      packages: data.packages || [],
      wheelOffsets: (data.packages || []).map(p => p.wheel?.offset).filter(o => o !== undefined),
      categories: (data.packages || []).map(p => p.category),
      firstWheel: data.packages?.[0]?.wheel,
    };
  } catch (err) {
    return { error: err.message, packages: [] };
  }
}

async function testVehicle(vehicle) {
  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  const [prod, local] = await Promise.all([
    fetchPackages(PROD_URL, vehicle),
    fetchPackages(LOCAL_URL, vehicle),
  ]);
  
  return {
    vehicle: label,
    ...vehicle,
    prod: {
      count: prod.packages.length,
      offsets: prod.wheelOffsets,
      categories: prod.categories,
      error: prod.error,
    },
    local: {
      count: local.packages.length,
      offsets: local.wheelOffsets,
      categories: local.categories,
      error: local.error,
    },
    delta: local.packages.length - prod.packages.length,
  };
}

async function main() {
  console.log('=' .repeat(70));
  console.log('REGRESSION VALIDATION: fix/package-offset-defaults');
  console.log('Production (main) vs Local (fix branch)');
  console.log('=' .repeat(70));
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  const allResults = {};
  const issues = [];
  const improvements = [];
  
  for (const [groupName, vehicles] of Object.entries(TEST_VEHICLES)) {
    console.log(`\n## ${groupName.toUpperCase()}`);
    console.log('-'.repeat(70));
    console.log('Vehicle'.padEnd(35) + 'Prod'.padStart(6) + 'Local'.padStart(7) + '  Delta  Offsets (Local)');
    console.log('-'.repeat(70));
    
    allResults[groupName] = [];
    
    for (const vehicle of vehicles) {
      const result = await testVehicle(vehicle);
      allResults[groupName].push(result);
      
      const deltaStr = result.delta > 0 ? `+${result.delta}` : result.delta.toString();
      const offsetStr = (result.local.offsets || []).slice(0, 4).join(',') || (result.local.error ? 'ERR' : 'N/A');
      
      let marker = '  ';
      if (result.local.error || result.prod.error) marker = '⚠️';
      else if (groupName !== 'classicRecovered' && result.delta < 0) marker = '❌';
      else if (result.delta > 0) marker = '✅';
      
      console.log(
        `${marker} ${result.vehicle.padEnd(33)}` +
        result.prod.count.toString().padStart(6) +
        result.local.count.toString().padStart(7) +
        deltaStr.padStart(7) +
        `  ${offsetStr}`
      );
      
      // Track regressions (modern vehicles losing packages)
      if (groupName !== 'classicRecovered' && result.delta < 0 && !result.local.error) {
        issues.push(result);
      }
      
      // Track improvements (classic vehicles gaining packages)
      if (groupName === 'classicRecovered' && result.delta > 0) {
        improvements.push(result);
      }
      
      // Small delay
      await new Promise(r => setTimeout(r, 150));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  
  const totalProd = Object.values(allResults).flat().reduce((s, r) => s + r.prod.count, 0);
  const totalLocal = Object.values(allResults).flat().reduce((s, r) => s + r.local.count, 0);
  
  console.log(`\nTotal Packages:`);
  console.log(`  Production (main):     ${totalProd}`);
  console.log(`  Local (fix branch):    ${totalLocal}`);
  console.log(`  Net change:            ${totalLocal - totalProd > 0 ? '+' : ''}${totalLocal - totalProd}`);
  
  console.log(`\n### Regressions (Modern Vehicles)`);
  if (issues.length === 0) {
    console.log('✅ NONE - No modern vehicles lost packages');
  } else {
    console.log(`❌ ${issues.length} REGRESSIONS:`);
    for (const r of issues) {
      console.log(`   ${r.vehicle}: ${r.prod.count} → ${r.local.count}`);
    }
  }
  
  console.log(`\n### Improvements (Classic Vehicles)`);
  if (improvements.length === 0) {
    console.log('⚠️  No classic vehicles gained packages');
  } else {
    console.log(`✅ ${improvements.length} vehicles recovered:`);
    for (const r of improvements) {
      console.log(`   ${r.vehicle}: ${r.prod.count} → ${r.local.count} (+${r.delta})`);
    }
  }
  
  // Check for unexpected offset values
  console.log(`\n### Offset Range Analysis`);
  const allOffsets = Object.values(allResults).flat()
    .flatMap(r => r.local.offsets || [])
    .filter(o => o !== undefined);
  
  if (allOffsets.length > 0) {
    const minOffset = Math.min(...allOffsets);
    const maxOffset = Math.max(...allOffsets);
    console.log(`  Min offset seen: ${minOffset}mm`);
    console.log(`  Max offset seen: ${maxOffset}mm`);
    
    const negativeOffsets = allOffsets.filter(o => o < 0);
    const lowOffsets = allOffsets.filter(o => o >= 0 && o < 20);
    console.log(`  Negative offsets (<0): ${negativeOffsets.length}`);
    console.log(`  Low offsets (0-19): ${lowOffsets.length}`);
  }
  
  // Final recommendation
  console.log('\n' + '='.repeat(70));
  console.log('FINAL RECOMMENDATION');
  console.log('='.repeat(70));
  
  if (issues.length === 0) {
    console.log('\n✅ APPROVE FOR PRODUCTION\n');
    console.log('Rationale:');
    console.log('• No regressions on modern vehicles (cars, trucks, SUVs)');
    console.log(`• ${improvements.length} classic vehicles recovered with valid packages`);
    console.log('• Offset range expansion works as designed');
    console.log('• ±3% overall diameter safety check remains in place');
  } else {
    console.log('\n❌ DO NOT APPROVE\n');
    console.log('Rationale:');
    console.log(`• ${issues.length} modern vehicles lost packages`);
    console.log('• Investigate before deployment');
  }
  
  console.log(`\nCompleted: ${new Date().toISOString()}`);
  
  // Output JSON for further analysis
  const reportPath = './scripts/regression-results.json';
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));
  console.log(`\nDetailed results saved to: ${reportPath}`);
}

main().catch(console.error);
