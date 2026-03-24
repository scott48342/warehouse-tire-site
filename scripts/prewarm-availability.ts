#!/usr/bin/env npx tsx

/**
 * Pre-warm Availability Cache CLI
 * 
 * Run this script to pre-warm the wheel availability cache for common vehicles.
 * Can be run manually or via cron job.
 * 
 * Usage:
 *   npx tsx scripts/prewarm-availability.ts [options]
 * 
 * Options:
 *   --dry-run       Simulate without making API calls
 *   --targets       Comma-separated target names (e.g., "F-150,Silverado")
 *   --max-skus      Max SKUs per pattern (default: 200)
 *   --concurrency   Concurrent API calls (default: 8)
 *   --verbose       Show detailed output
 * 
 * Examples:
 *   npx tsx scripts/prewarm-availability.ts
 *   npx tsx scripts/prewarm-availability.ts --dry-run
 *   npx tsx scripts/prewarm-availability.ts --targets "F-150,Ram 1500" --max-skus 100
 */

import { runPrewarmJob, PREWARM_TARGETS } from "../src/lib/availabilityPrewarm";
import { getCacheStats } from "../src/lib/availabilityCache";

async function main() {
  const args = process.argv.slice(2);
  
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");
  
  // Parse --targets
  const targetsIndex = args.indexOf("--targets");
  let targetNames: string[] | undefined;
  if (targetsIndex !== -1 && args[targetsIndex + 1]) {
    targetNames = args[targetsIndex + 1].split(",").map(t => t.trim());
  }
  
  // Parse --max-skus
  const maxSkusIndex = args.indexOf("--max-skus");
  let maxSkusPerPattern: number | undefined;
  if (maxSkusIndex !== -1 && args[maxSkusIndex + 1]) {
    maxSkusPerPattern = parseInt(args[maxSkusIndex + 1], 10);
  }
  
  // Parse --concurrency
  const concurrencyIndex = args.indexOf("--concurrency");
  let concurrency: number | undefined;
  if (concurrencyIndex !== -1 && args[concurrencyIndex + 1]) {
    concurrency = parseInt(args[concurrencyIndex + 1], 10);
  }
  
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║         Wheel Availability Pre-Warm Job                       ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log();
  
  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No API calls will be made\n");
  }
  
  // Filter targets if specified
  let targets = PREWARM_TARGETS;
  if (targetNames && targetNames.length > 0) {
    targets = PREWARM_TARGETS.filter(t => 
      targetNames.some(name => 
        t.name.toLowerCase().includes(name.toLowerCase()) ||
        t.boltPattern === name
      )
    );
    console.log(`📋 Filtered targets: ${targets.map(t => t.name).join(", ")}\n`);
  }
  
  console.log("📋 Target Vehicles:");
  for (const t of targets) {
    console.log(`   • ${t.name} (${t.boltPattern}) - Priority ${t.priority}`);
  }
  console.log();
  
  // Show initial cache stats
  const initialStats = getCacheStats();
  console.log("📊 Initial Cache State:");
  console.log(`   Size: ${initialStats.size} / ${initialStats.maxSize}`);
  console.log(`   Hit Rate: ${(initialStats.hitRate * 100).toFixed(1)}%`);
  console.log(`   Pre-warmed Entries: ${initialStats.prewarmedEntries}`);
  console.log();
  
  console.log("🚀 Starting pre-warm job...\n");
  
  const result = await runPrewarmJob({
    targets,
    maxSkusPerPattern,
    concurrency,
    dryRun,
  });
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                        RESULTS");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  if (result.success) {
    console.log("✅ Pre-warm job completed successfully!\n");
  } else {
    console.log("⚠️  Pre-warm job completed with errors\n");
  }
  
  console.log(`⏱️  Duration: ${result.duration}ms (${(result.duration / 1000).toFixed(1)}s)`);
  console.log(`📦 Targets Processed: ${result.targetsProcessed}`);
  console.log(`🔍 Total SKUs Checked: ${result.totalSkusChecked}`);
  console.log(`✓  SKUs Available: ${result.totalSkusAvailable}`);
  console.log(`💾 SKUs Cached: ${result.totalSkusCached}`);
  console.log();
  
  if (verbose) {
    console.log("📋 Target Results:");
    for (const tr of result.targetResults) {
      console.log(`   ${tr.name} (${tr.boltPattern}):`);
      console.log(`      Candidates: ${tr.candidates}`);
      console.log(`      Checked: ${tr.checked}`);
      console.log(`      Available: ${tr.available}`);
      console.log(`      Cached: ${tr.cached}`);
      console.log(`      Duration: ${tr.durationMs}ms`);
    }
    console.log();
  }
  
  if (result.errors.length > 0) {
    console.log("❌ Errors:");
    for (const err of result.errors) {
      console.log(`   • ${err}`);
    }
    console.log();
  }
  
  console.log("📊 Final Cache State:");
  console.log(`   Size: ${result.cacheStats.size} / ${result.cacheStats.maxSize}`);
  console.log(`   Total Hits: ${result.cacheStats.hits}`);
  console.log(`   Total Misses: ${result.cacheStats.misses}`);
  console.log(`   Hit Rate: ${(result.cacheStats.hitRate * 100).toFixed(1)}%`);
  console.log(`   Pre-warmed Entries: ${result.cacheStats.prewarmedEntries}`);
  console.log(`   Pre-warmed Hits: ${result.cacheStats.prewarmedHits}`);
  console.log();
  
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
