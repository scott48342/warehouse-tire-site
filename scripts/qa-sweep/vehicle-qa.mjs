#!/usr/bin/env node
/**
 * Vehicle QA Sweep - Tests wheel fitment and tire search for vehicles
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';
const batchFile = process.argv[2];
const batchName = process.argv[3] || 'batch';

if (!batchFile) {
  console.error('Usage: node vehicle-qa.mjs <batch-file.json> [batch-name]');
  process.exit(1);
}

const batchPath = path.resolve(__dirname, batchFile);
const batch = JSON.parse(fs.readFileSync(batchPath, 'utf-8'));

console.log(`\n🚗 Vehicle QA Sweep: ${batch.name || batchName}`);
console.log(`📍 Testing against: ${BASE_URL}`);
console.log(`📋 Vehicles: ${batch.vehicles.length}\n`);

const results = {
  batchName: batch.name || batchName,
  baseUrl: BASE_URL,
  startTime: new Date().toISOString(),
  total: batch.vehicles.length,
  passed: 0,
  failed: 0,
  vehicles: []
};

async function fetchWithTimeout(url, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function testVehicle(vehicle) {
  const { year, make, model, trim } = vehicle;
  const label = `${year} ${make} ${model} ${trim || ''}`.trim();
  
  const result = {
    vehicle: label,
    year, make, model, trim,
    wheelsOk: false,
    tiresOk: false,
    passed: false,
    wheelCount: 0,
    tireCount: 0,
    errors: []
  };

  try {
    // Test wheel fitment
    const wheelUrl = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ''}`;
    
    const wheelRes = await fetchWithTimeout(wheelUrl);
    const wheelData = await wheelRes.json();
    
    const wheels = wheelData.results || wheelData.wheels || [];
    if (wheelRes.ok && wheels.length > 0) {
      result.wheelsOk = true;
      result.wheelCount = wheels.length;
      result.totalWheels = wheelData.totalCount || wheels.length;
      result.isStaggered = wheelData.fitment?.staggered?.isStaggered || false;
      result.fitmentInfo = wheelData.fitment || null;
    } else if (wheelRes.ok && wheels.length === 0) {
      result.errors.push('No wheels found');
    } else {
      result.errors.push(`Wheel API error: ${wheelData.error || wheelRes.status}`);
    }
  } catch (err) {
    result.errors.push(`Wheel fetch error: ${err.message}`);
  }

  try {
    // Test tire search
    const tireUrl = `${BASE_URL}/api/tires/search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ''}&limit=10`;
    
    const tireRes = await fetchWithTimeout(tireUrl);
    const tireData = await tireRes.json();
    
    const tires = tireData.results || tireData.tires || [];
    if (tireRes.ok && tires.length > 0) {
      result.tiresOk = true;
      result.tireCount = tires.length;
      result.tireSizes = tireData.oemTireSizes || tireData.tireSizesSearched || null;
    } else if (tireRes.ok && tires.length === 0) {
      result.errors.push('No tires found');
    } else {
      result.errors.push(`Tire API error: ${tireData.error || tireRes.status}`);
    }
  } catch (err) {
    result.errors.push(`Tire fetch error: ${err.message}`);
  }

  result.passed = result.wheelsOk && result.tiresOk;
  return result;
}

async function runBatch() {
  let completed = 0;
  
  for (const vehicle of batch.vehicles) {
    const result = await testVehicle(vehicle);
    results.vehicles.push(result);
    
    if (result.passed) {
      results.passed++;
      process.stdout.write('✅');
    } else {
      results.failed++;
      process.stdout.write('❌');
    }
    
    completed++;
    if (completed % 20 === 0) {
      process.stdout.write(` ${completed}/${results.total}\n`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  
  results.endTime = new Date().toISOString();
  results.passRate = ((results.passed / results.total) * 100).toFixed(1) + '%';
  
  // Save results
  const resultsFile = path.join(__dirname, `results-${batchName}-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`📊 QA Results: ${batch.name || batchName}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total:       ${results.total}`);
  console.log(`Passed:      ${results.passed}`);
  console.log(`Failed:      ${results.failed}`);
  console.log(`Pass Rate:   ${results.passRate}`);
  console.log(`${'='.repeat(60)}`);
  
  if (results.failed > 0) {
    console.log(`\n❌ Failed Vehicles:`);
    for (const v of results.vehicles.filter(v => !v.passed)) {
      console.log(`  • ${v.vehicle}`);
      console.log(`    Wheels: ${v.wheelsOk ? '✅' : '❌'} (${v.wheelCount}), Tires: ${v.tiresOk ? '✅' : '❌'} (${v.tireCount})`);
      if (v.errors.length > 0) {
        console.log(`    Errors: ${v.errors.join('; ')}`);
      }
    }
  }
  
  console.log(`\n📁 Results saved to: ${resultsFile}`);
}

runBatch().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
