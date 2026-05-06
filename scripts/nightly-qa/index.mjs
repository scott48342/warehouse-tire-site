#!/usr/bin/env node
/**
 * Nightly QA Sweep
 * 
 * Entry point for automated QA testing.
 * 
 * Usage:
 *   node scripts/nightly-qa/index.mjs [options]
 * 
 * Options:
 *   --count N        Number of vehicles to test (default: 250)
 *   --category CAT   Test only this category
 *   --quick          Quick mode (50 vehicles, canaries only)
 *   --verbose        Verbose output
 *   --dry-run        Don't write to database
 * 
 * Environment:
 *   BASE_URL         Target environment URL
 *   POSTGRES_URL     Database connection string
 *   QA_CONCURRENCY   Parallel test count (default: 5)
 */

import { randomUUID } from 'crypto';
import { config } from './config.mjs';
import { buildVehiclePool } from './vehicle-pool.mjs';
import { testVehicles } from './worker.mjs';
import { createDbReporter } from './reporters/db-reporter.mjs';
import { createJsonReporter } from './reporters/json-reporter.mjs';
import { createMarkdownReporter } from './reporters/markdown-reporter.mjs';

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] || true;
};

const options = {
  count: parseInt(getArg('count') || config.targetVehicleCount, 10),
  category: getArg('category'),
  quick: args.includes('--quick'),
  verbose: args.includes('--verbose'),
  dryRun: args.includes('--dry-run'),
};

if (options.quick) {
  options.count = 50;
}

console.log(`
╔══════════════════════════════════════════════════════════════╗
║               NIGHTLY QA SWEEP - Warehouse Tire              ║
╠══════════════════════════════════════════════════════════════╣
║  Target:      ${config.baseUrl.padEnd(47)}║
║  Vehicles:    ${String(options.count).padEnd(47)}║
║  Concurrency: ${String(config.concurrency).padEnd(47)}║
${options.category ? `║  Category:    ${options.category.padEnd(47)}║\n` : ''}${options.dryRun ? `║  Mode:        DRY RUN (no DB writes)                         ║\n` : ''}╚══════════════════════════════════════════════════════════════╝
`);

async function main() {
  const startTime = Date.now();
  const runId = randomUUID().slice(0, 8);
  
  console.log(`[${new Date().toISOString()}] Starting run ${runId}...\n`);
  
  // Build vehicle pool
  console.log('[1/4] Building vehicle pool...');
  let vehicles = await buildVehiclePool(options.count);
  
  // Filter by category if specified
  if (options.category) {
    vehicles = vehicles.filter(v => v.category === options.category);
    console.log(`  Filtered to ${vehicles.length} ${options.category} vehicles`);
  }
  
  console.log(`  Selected ${vehicles.length} vehicles for testing\n`);
  
  // Initialize reporters
  console.log('[2/4] Initializing reporters...');
  
  const dbReporter = createDbReporter();
  const jsonReporter = createJsonReporter(runId);
  const mdReporter = createMarkdownReporter(runId);
  
  const metadata = {
    startedAt: new Date().toISOString(),
    commitHash: process.env.COMMIT_SHA || process.env.GITHUB_SHA || null,
    deploymentVersion: process.env.VERCEL_GIT_COMMIT_SHA || null,
    triggerSource: process.env.TRIGGER_SOURCE || 'manual',
  };
  
  if (!options.dryRun) {
    const dbRunId = await dbReporter.init(metadata);
    if (dbRunId) {
      console.log(`  Database run ID: ${dbRunId}`);
    }
  }
  
  console.log('');
  
  // Run tests
  console.log('[3/4] Running tests...\n');
  
  let lastProgress = 0;
  const results = await testVehicles(vehicles, {
    concurrency: config.concurrency,
    onProgress: (progress) => {
      // Log every 10%
      const pct = Math.floor(progress.percent / 10) * 10;
      if (pct > lastProgress) {
        lastProgress = pct;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const passCount = progress.lastBatch?.filter(r => r.status === 'pass').length || 0;
        const failCount = progress.lastBatch?.filter(r => r.status === 'fail').length || 0;
        console.log(`  ${pct}% (${progress.completed}/${progress.total}) - ${elapsed}s elapsed - batch: ${passCount}✓ ${failCount}✗`);
      }
      
      if (options.verbose && progress.lastBatch) {
        for (const r of progress.lastBatch) {
          const status = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '?';
          const vehicle = `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`;
          if (r.status !== 'pass') {
            console.log(`    ${status} ${vehicle}: ${r.errors?.[0] || 'failed'}`);
          }
        }
      }
    },
  });
  
  console.log('\n');
  
  // Write results
  console.log('[4/4] Writing results...');
  
  // Save to DB
  if (!options.dryRun) {
    try {
      await dbReporter.saveBatch(results);
      const summary = await dbReporter.complete(results);
      console.log(`  Database: ${results.length} results saved`);
    } catch (err) {
      console.error(`  Database error: ${err.message}`);
    }
  }
  
  // Save JSON
  try {
    const jsonFile = await jsonReporter.writeResults(results, metadata);
    await jsonReporter.writeSummary(results, metadata);
    console.log(`  JSON: ${jsonFile}`);
  } catch (err) {
    console.error(`  JSON error: ${err.message}`);
  }
  
  // Save Markdown
  try {
    const mdFile = await mdReporter.writeReport(results, metadata);
    await mdReporter.writeFailures(results);
    console.log(`  Markdown: ${mdFile}`);
  } catch (err) {
    console.error(`  Markdown error: ${err.message}`);
  }
  
  // Cleanup
  await dbReporter.close();
  
  // Print summary with new metrics
  const duration = Math.round((Date.now() - startTime) / 1000);
  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const logicPassed = results.filter(r => r.logicStatus === 'pass').length;
  const knownGaps = results.filter(r => r.isKnownGap).length;
  
  // Calculate rates
  const rawPassRate = Math.round((passed / results.length) * 100);
  const logicPassRate = Math.round((logicPassed / results.length) * 100);
  
  // Critical regressions = actual problems (not data gaps)
  const criticalRegressions = results.filter(r => 
    r.logicStatus === 'fail' && 
    !r.isKnownGap && 
    (r.severity === 'critical' || r.severity === 'high')
  ).length;
  
  const dataGaps = results.filter(r => r.failureType === 'data_gap').length;
  const inventoryGaps = results.filter(r => r.failureType === 'inventory').length;
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                        QA SWEEP COMPLETE                     ║
╠══════════════════════════════════════════════════════════════╣
║  Duration:        ${String(duration + 's').padEnd(43)}║
║  Vehicles:        ${String(results.length).padEnd(43)}║
╠══════════════════════════════════════════════════════════════╣
║  ✅ Passed:       ${String(passed).padEnd(43)}║
║  ⚠️  Warnings:     ${String(warnings).padEnd(43)}║
║  ❌ Failed:       ${String(failed).padEnd(43)}║
╠══════════════════════════════════════════════════════════════╣
║  📊 LOGIC PASS:   ${(logicPassRate + '%').padEnd(43)}║
║  📊 Raw Pass:     ${(rawPassRate + '%').padEnd(43)}║
╠══════════════════════════════════════════════════════════════╣
║  📋 Data Gaps:    ${String(dataGaps).padEnd(43)}║
║  📦 Inventory:    ${String(inventoryGaps).padEnd(43)}║
║  🏷️  Known Gaps:   ${String(knownGaps).padEnd(43)}║
${criticalRegressions > 0 ? `╠══════════════════════════════════════════════════════════════╣
║  🚨 REGRESSIONS:  ${String(criticalRegressions).padEnd(43)}║\n` : ''}╚══════════════════════════════════════════════════════════════╝
`);
  
  // Exit with error code ONLY if there are actual regressions
  // Data gaps and inventory issues are NOT exit-code failures
  if (criticalRegressions > 0) {
    console.log('🚨 Critical regressions detected - exiting with code 1');
    process.exit(1);
  }
  
  if (logicPassRate < 100) {
    console.log(`ℹ️  ${results.length - logicPassed} vehicle(s) with issues (data gaps or inventory)`);
  }
  
  console.log('✅ No critical regressions detected');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
