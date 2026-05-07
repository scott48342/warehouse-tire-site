/**
 * QA Batch 2 Runner - Tests vehicles 100-199
 * 
 * Tests wheel fitment, tire availability, and package flow
 * against the production site.
 */

import { testVehicles } from './worker.mjs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Override config for production testing
process.env.BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

async function runBatch2() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  QA BATCH 2 - Vehicles 100-199');
  console.log('  Target: ' + process.env.BASE_URL);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  
  // Load batch 2 vehicles
  const batchFile = path.join(__dirname, 'batch-2-vehicles.json');
  const vehiclesRaw = await readFile(batchFile, 'utf-8');
  const vehicles = JSON.parse(vehiclesRaw);
  
  console.log(`Loaded ${vehicles.length} vehicles for testing`);
  console.log('');
  
  // Category breakdown
  const categories = {};
  for (const v of vehicles) {
    categories[v.category] = (categories[v.category] || 0) + 1;
  }
  console.log('Category distribution:');
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log('');
  
  const startTime = Date.now();
  
  // Run tests with progress reporting
  const results = await testVehicles(vehicles, {
    concurrency: 3,  // Conservative for production
    onProgress: ({ completed, total, percent, lastBatch }) => {
      const passed = lastBatch.filter(r => r.status === 'pass').length;
      const warned = lastBatch.filter(r => r.status === 'warning').length;
      const failed = lastBatch.filter(r => r.status === 'fail').length;
      console.log(`[${percent}%] ${completed}/${total} - Last batch: ${passed} pass, ${warned} warn, ${failed} fail`);
    }
  });
  
  const duration = Date.now() - startTime;
  
  // Calculate summary
  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const logicPassed = results.filter(r => r.logicStatus === 'pass').length;
  const passRate = ((passed / results.length) * 100).toFixed(1);
  const logicPassRate = ((logicPassed / results.length) * 100).toFixed(1);
  
  // Categorize failures by severity
  const criticalFailures = results.filter(r => r.severity === 'critical' && r.status === 'fail');
  const highFailures = results.filter(r => r.severity === 'high' && r.status === 'fail');
  const mediumFailures = results.filter(r => r.severity === 'medium' && r.status === 'fail');
  
  // Results by category
  const categoryResults = {};
  for (const r of results) {
    const cat = r.vehicle.category;
    if (!categoryResults[cat]) {
      categoryResults[cat] = { passed: 0, warned: 0, failed: 0, total: 0 };
    }
    categoryResults[cat].total++;
    if (r.status === 'pass') categoryResults[cat].passed++;
    else if (r.status === 'warning') categoryResults[cat].warned++;
    else categoryResults[cat].failed++;
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  BATCH 2 RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total tested:     ${results.length}`);
  console.log(`Passed:           ${passed} (${passRate}%)`);
  console.log(`Warnings:         ${warnings}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Logic pass rate:  ${logicPassRate}%`);
  console.log(`Duration:         ${(duration / 1000).toFixed(1)}s`);
  console.log('');
  
  console.log('Results by Category:');
  for (const [cat, stats] of Object.entries(categoryResults).sort((a, b) => b[1].total - a[1].total)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    console.log(`  ${cat.padEnd(12)}: ${stats.passed}/${stats.total} pass (${rate}%), ${stats.warned} warn, ${stats.failed} fail`);
  }
  console.log('');
  
  if (criticalFailures.length > 0) {
    console.log('🚨 CRITICAL FAILURES:');
    for (const r of criticalFailures) {
      const v = r.vehicle;
      console.log(`  - ${v.year} ${v.make} ${v.model} ${v.trim || ''}`);
      console.log(`    ${r.errors[0] || 'Unknown error'}`);
    }
    console.log('');
  }
  
  if (highFailures.length > 0) {
    console.log('⚠️  HIGH SEVERITY FAILURES:');
    for (const r of highFailures) {
      const v = r.vehicle;
      console.log(`  - ${v.year} ${v.make} ${v.model} ${v.trim || ''}`);
      console.log(`    ${r.errors[0] || 'Unknown error'}`);
    }
    console.log('');
  }
  
  // Show all failures for detailed analysis
  const allFailures = results.filter(r => r.status === 'fail');
  if (allFailures.length > 0 && allFailures.length <= 20) {
    console.log('ALL FAILURES:');
    for (const r of allFailures) {
      const v = r.vehicle;
      console.log(`  [${r.severity || 'unknown'}] ${v.year} ${v.make} ${v.model} ${v.trim || ''}`);
      for (const err of r.errors.slice(0, 2)) {
        console.log(`    - ${err}`);
      }
    }
    console.log('');
  }
  
  // Save detailed results
  const resultsFile = path.join(__dirname, `results-batch-2-${Date.now()}.json`);
  await writeFile(resultsFile, JSON.stringify({
    batch: 2,
    timestamp: new Date().toISOString(),
    baseUrl: process.env.BASE_URL,
    summary: {
      total: results.length,
      passed,
      warnings,
      failed,
      passRate: parseFloat(passRate),
      logicPassRate: parseFloat(logicPassRate),
      durationMs: duration,
    },
    categoryResults,
    criticalFailures: criticalFailures.map(r => ({
      vehicle: r.vehicle,
      errors: r.errors,
      severity: r.severity,
      failureType: r.failureType,
    })),
    results,
  }, null, 2));
  
  console.log(`Detailed results saved to: ${resultsFile}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  
  // Exit code
  if (criticalFailures.length > 0) {
    process.exit(2);
  } else if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runBatch2().catch(err => {
  console.error('Fatal error:', err);
  process.exit(3);
});
