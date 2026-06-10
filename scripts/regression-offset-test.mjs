#!/usr/bin/env node
/**
 * Regression Validation: fix/package-offset-defaults
 * 
 * Tests package generation before/after the offset range expansion
 * to ensure modern vehicles aren't negatively impacted while
 * classic/recovered vehicles gain valid packages.
 */

import { execSync } from 'child_process';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Test groups
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
    // Classic vehicles that should be recovered by this fix
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

async function fetchPackages(vehicle) {
  const params = new URLSearchParams({
    year: vehicle.year.toString(),
    make: vehicle.make,
    model: vehicle.model,
  });
  
  try {
    const response = await fetch(`${BASE_URL}/api/packages/generate?${params}`);
    if (!response.ok) {
      return { error: `HTTP ${response.status}`, packages: [] };
    }
    const data = await response.json();
    return {
      packages: data.packages || [],
      wheelOffsets: (data.packages || []).map(p => p.wheel?.offset).filter(Boolean),
      categories: (data.packages || []).map(p => p.category),
    };
  } catch (err) {
    return { error: err.message, packages: [] };
  }
}

async function runTests(branchName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing on branch: ${branchName}`);
  console.log('='.repeat(60));
  
  const results = {};
  
  for (const [groupName, vehicles] of Object.entries(TEST_VEHICLES)) {
    console.log(`\n## ${groupName}`);
    results[groupName] = [];
    
    for (const vehicle of vehicles) {
      const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      const result = await fetchPackages(vehicle);
      
      results[groupName].push({
        vehicle: label,
        packageCount: result.packages.length,
        offsets: result.wheelOffsets,
        categories: result.categories,
        error: result.error,
      });
      
      if (result.error) {
        console.log(`  ❌ ${label}: ERROR - ${result.error}`);
      } else if (result.packages.length === 0) {
        console.log(`  ⚠️  ${label}: 0 packages`);
      } else {
        const offsets = result.wheelOffsets.join(', ') || 'N/A';
        console.log(`  ✅ ${label}: ${result.packages.length} packages (offsets: ${offsets})`);
      }
      
      // Small delay to not hammer the server
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  return results;
}

function compareResults(before, after) {
  console.log('\n' + '='.repeat(60));
  console.log('REGRESSION COMPARISON');
  console.log('='.repeat(60));
  
  const issues = [];
  const improvements = [];
  const stable = [];
  
  for (const [groupName, vehicles] of Object.entries(before)) {
    console.log(`\n## ${groupName}`);
    console.log('-'.repeat(50));
    console.log('Vehicle'.padEnd(40) + 'Before'.padStart(8) + 'After'.padStart(8) + '  Delta');
    console.log('-'.repeat(50));
    
    for (let i = 0; i < vehicles.length; i++) {
      const b = vehicles[i];
      const a = after[groupName][i];
      const delta = a.packageCount - b.packageCount;
      const deltaStr = delta > 0 ? `+${delta}` : delta.toString();
      
      console.log(
        b.vehicle.padEnd(40) +
        b.packageCount.toString().padStart(8) +
        a.packageCount.toString().padStart(8) +
        deltaStr.padStart(8)
      );
      
      // Check for regression (modern vehicles losing packages)
      if (groupName !== 'classicRecovered' && delta < 0) {
        issues.push({
          vehicle: b.vehicle,
          before: b.packageCount,
          after: a.packageCount,
          delta,
          beforeOffsets: b.offsets,
          afterOffsets: a.offsets,
        });
      }
      
      // Check for improvements (classic vehicles gaining packages)
      if (groupName === 'classicRecovered' && delta > 0) {
        improvements.push({
          vehicle: b.vehicle,
          before: b.packageCount,
          after: a.packageCount,
          delta,
        });
      }
      
      // Track stability
      if (delta === 0) {
        stable.push(b.vehicle);
      }
    }
  }
  
  return { issues, improvements, stable };
}

function generateReport(before, after, comparison) {
  console.log('\n' + '='.repeat(60));
  console.log('REGRESSION VALIDATION REPORT');
  console.log('='.repeat(60));
  
  // Summary stats
  const totalBefore = Object.values(before).flat().reduce((sum, v) => sum + v.packageCount, 0);
  const totalAfter = Object.values(after).flat().reduce((sum, v) => sum + v.packageCount, 0);
  
  console.log(`\n### Summary`);
  console.log(`Total packages BEFORE: ${totalBefore}`);
  console.log(`Total packages AFTER:  ${totalAfter}`);
  console.log(`Net change: ${totalAfter - totalBefore > 0 ? '+' : ''}${totalAfter - totalBefore}`);
  
  console.log(`\n### Regressions (Modern Vehicles Losing Packages)`);
  if (comparison.issues.length === 0) {
    console.log('✅ NONE - All modern vehicles maintained or improved package counts');
  } else {
    console.log('❌ REGRESSIONS DETECTED:');
    for (const issue of comparison.issues) {
      console.log(`  - ${issue.vehicle}: ${issue.before} → ${issue.after} (${issue.delta})`);
      console.log(`    Before offsets: ${issue.beforeOffsets.join(', ') || 'N/A'}`);
      console.log(`    After offsets: ${issue.afterOffsets.join(', ') || 'N/A'}`);
    }
  }
  
  console.log(`\n### Improvements (Classic Vehicles Recovered)`);
  if (comparison.improvements.length === 0) {
    console.log('⚠️  No classic vehicles gained packages (may need investigation)');
  } else {
    console.log(`✅ ${comparison.improvements.length} vehicles recovered:`);
    for (const imp of comparison.improvements) {
      console.log(`  - ${imp.vehicle}: ${imp.before} → ${imp.after} (+${imp.delta})`);
    }
  }
  
  console.log(`\n### Stability`);
  console.log(`${comparison.stable.length} vehicles unchanged`);
  
  // Final recommendation
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RECOMMENDATION');
  console.log('='.repeat(60));
  
  if (comparison.issues.length === 0) {
    console.log('\n✅ APPROVE FOR PRODUCTION');
    console.log('\nRationale:');
    console.log('- No regressions detected on modern vehicles');
    console.log(`- ${comparison.improvements.length} classic vehicles recovered`);
    console.log('- Package generation remains stable for healthy vehicles');
  } else {
    console.log('\n❌ DO NOT APPROVE');
    console.log('\nRationale:');
    console.log(`- ${comparison.issues.length} modern vehicles lost packages`);
    console.log('- Requires investigation before deployment');
  }
}

async function main() {
  console.log('Package Offset Defaults - Regression Validation');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Started: ${new Date().toISOString()}`);
  
  // First, run tests on main branch
  console.log('\n🔄 Switching to main branch...');
  try {
    execSync('git checkout main', { cwd: process.cwd(), stdio: 'pipe' });
  } catch (e) {
    console.log('⚠️  Could not switch branches - testing current state only');
  }
  
  // Wait for server to potentially restart
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n📊 Running BEFORE tests (main branch)...');
  const beforeResults = await runTests('main');
  
  // Switch to fix branch
  console.log('\n🔄 Switching to fix/package-offset-defaults branch...');
  try {
    execSync('git checkout fix/package-offset-defaults', { cwd: process.cwd(), stdio: 'pipe' });
  } catch (e) {
    console.log('⚠️  Could not switch branches - using current state for AFTER');
  }
  
  // Wait for server to potentially restart
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n📊 Running AFTER tests (fix branch)...');
  const afterResults = await runTests('fix/package-offset-defaults');
  
  // Compare results
  const comparison = compareResults(beforeResults, afterResults);
  
  // Generate final report
  generateReport(beforeResults, afterResults, comparison);
  
  // Return to fix branch
  try {
    execSync('git checkout fix/package-offset-defaults', { cwd: process.cwd(), stdio: 'pipe' });
  } catch (e) {}
  
  console.log(`\nCompleted: ${new Date().toISOString()}`);
}

main().catch(console.error);
