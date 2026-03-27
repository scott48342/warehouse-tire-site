#!/usr/bin/env npx tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BULK FITMENT IMPORT SCRIPT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Pre-populates vehicle_fitments table with high-demand vehicles to reduce
 * reliance on Wheel-Size API.
 * 
 * Usage:
 *   npx tsx scripts/bulk-import-fitment.ts [options]
 * 
 * Options:
 *   --tier1           Import Tier 1 vehicles only (highest volume)
 *   --tier2           Import Tier 1 + Tier 2 vehicles
 *   --all             Import all tiers (default)
 *   --years=2024,2023 Specific years to import (default: 2010-2025)
 *   --dry-run         Show what would be imported without doing it
 *   --skip-existing   Skip vehicles already in DB (default: true)
 *   --delay=1000      Delay between API calls in ms (default: 1000)
 *   --coverage        Just show coverage stats, don't import
 *   --verbose         Show detailed progress
 * 
 * Examples:
 *   npx tsx scripts/bulk-import-fitment.ts --coverage
 *   npx tsx scripts/bulk-import-fitment.ts --tier1 --dry-run
 *   npx tsx scripts/bulk-import-fitment.ts --tier1 --years=2024,2023
 *   npx tsx scripts/bulk-import-fitment.ts --all --delay=2000
 * 
 * @created 2026-03-27
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");

// Load .env.local manually to handle Vercel format (quoted values)
const envPath = ".env.local";
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx);
        let value = trimmed.slice(eqIdx + 1);
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// Load after env is set
const {
  calculateCoverage,
  executeBulkImport,
  printTargetSummary,
  getTotalTargetCount,
  TIER_1_VEHICLES,
  TIER_2_VEHICLES,
  TIER_3_VEHICLES,
  IMPORT_YEARS,
} = require("../src/lib/fitment-db/bulkImportStrategy");

import type { BulkImportConfig } from "../src/lib/fitment-db/bulkImportStrategy";

// ═══════════════════════════════════════════════════════════════════════════════
// CLI ARGUMENT PARSING
// ═══════════════════════════════════════════════════════════════════════════════

function parseArgs(): {
  tiers: ("tier1" | "tier2" | "tier3")[];
  years: number[];
  dryRun: boolean;
  skipExisting: boolean;
  delay: number;
  coverageOnly: boolean;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  
  let tiers: ("tier1" | "tier2" | "tier3")[] = ["tier1", "tier2", "tier3"];
  let years = [...IMPORT_YEARS];
  let dryRun = false;
  let skipExisting = true;
  let delay = 1000;
  let coverageOnly = false;
  let verbose = false;
  
  for (const arg of args) {
    if (arg === "--tier1") {
      tiers = ["tier1"];
    } else if (arg === "--tier2") {
      tiers = ["tier1", "tier2"];
    } else if (arg === "--all") {
      tiers = ["tier1", "tier2", "tier3"];
    } else if (arg.startsWith("--years=")) {
      const yearStr = arg.split("=")[1];
      years = yearStr.split(",").map(y => parseInt(y.trim(), 10)).filter(y => !isNaN(y));
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-skip-existing") {
      skipExisting = false;
    } else if (arg.startsWith("--delay=")) {
      delay = parseInt(arg.split("=")[1], 10) || 1000;
    } else if (arg === "--coverage") {
      coverageOnly = true;
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  
  return { tiers, years, dryRun, skipExisting, delay, coverageOnly, verbose };
}

function printHelp() {
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
BULK FITMENT IMPORT SCRIPT
═══════════════════════════════════════════════════════════════════════════════

Pre-populates vehicle_fitments table with high-demand vehicles.

Usage:
  npx tsx scripts/bulk-import-fitment.ts [options]

Options:
  --tier1           Import Tier 1 vehicles only (top 50)
  --tier2           Import Tier 1 + Tier 2 vehicles (top 150)
  --all             Import all tiers (default, ~200 vehicles)
  --years=2024,2023 Specific years to import (default: 2010-2025)
  --dry-run         Show what would be imported without doing it
  --no-skip-existing  Re-import even if vehicle exists
  --delay=1000      Delay between API calls in ms (default: 1000)
  --coverage        Just show coverage stats, don't import
  --verbose, -v     Show detailed progress

Examples:
  npx tsx scripts/bulk-import-fitment.ts --coverage
  npx tsx scripts/bulk-import-fitment.ts --tier1 --dry-run
  npx tsx scripts/bulk-import-fitment.ts --tier1 --years=2024,2023,2022
  npx tsx scripts/bulk-import-fitment.ts --all --delay=2000
`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("BULK FITMENT IMPORT");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  const args = parseArgs();
  
  // Check database connection
  if (!process.env.POSTGRES_URL) {
    console.error("❌ POSTGRES_URL not set. Make sure .env.local is configured.");
    process.exit(1);
  }
  
  // Print target summary
  printTargetSummary();
  
  // Show current coverage
  console.log("\n📊 CURRENT COVERAGE\n");
  const coverage = await calculateCoverage();
  
  console.log(`Total target vehicles: ${coverage.totalTargetVehicles}`);
  console.log(`Populated in DB:       ${coverage.populatedVehicles}`);
  console.log(`Coverage:              ${coverage.coveragePercent}%`);
  console.log("");
  console.log("By Tier:");
  console.log(`  Tier 1: ${coverage.byTier.tier1.populated}/${coverage.byTier.tier1.total} (${coverage.byTier.tier1.percent}%)`);
  console.log(`  Tier 2: ${coverage.byTier.tier2.populated}/${coverage.byTier.tier2.total} (${coverage.byTier.tier2.percent}%)`);
  console.log(`  Tier 3: ${coverage.byTier.tier3.populated}/${coverage.byTier.tier3.total} (${coverage.byTier.tier3.percent}%)`);
  console.log("");
  console.log("By Year (recent):");
  for (const year of IMPORT_YEARS.slice(0, 6)) {
    const yearStats = coverage.byYear[year];
    if (yearStats) {
      console.log(`  ${year}: ${yearStats.populated}/${yearStats.total} (${yearStats.percent}%)`);
    }
  }
  console.log("");
  console.log(`📈 Estimated search coverage: ${coverage.estimatedSearchCoverage}%`);
  console.log(`📉 Estimated API reduction:   ${coverage.estimatedApiReduction}%`);
  
  if (args.coverageOnly) {
    console.log("\n✅ Coverage check complete (--coverage flag set, not importing)\n");
    process.exit(0);
  }
  
  // Confirm import
  console.log("\n─────────────────────────────────────────────────────────────────────────────────");
  console.log("IMPORT CONFIGURATION\n");
  console.log(`Tiers:         ${args.tiers.join(", ")}`);
  console.log(`Years:         ${args.years.join(", ")}`);
  console.log(`Dry run:       ${args.dryRun}`);
  console.log(`Skip existing: ${args.skipExisting}`);
  console.log(`Delay:         ${args.delay}ms`);
  
  const vehicleCount = args.tiers.reduce((sum, tier) => {
    if (tier === "tier1") return sum + TIER_1_VEHICLES.length;
    if (tier === "tier2") return sum + TIER_2_VEHICLES.length;
    if (tier === "tier3") return sum + TIER_3_VEHICLES.length;
    return sum;
  }, 0);
  
  const totalRecords = vehicleCount * args.years.length;
  console.log(`\nTotal vehicles to process: ${totalRecords}`);
  
  const estimatedTime = (totalRecords * (args.delay + 500)) / 1000 / 60; // rough estimate
  console.log(`Estimated time: ~${estimatedTime.toFixed(0)} minutes`);
  
  if (args.dryRun) {
    console.log("\n🔍 DRY RUN MODE - No actual imports will be made\n");
  }
  
  console.log("\n─────────────────────────────────────────────────────────────────────────────────");
  console.log("Starting import in 3 seconds... (Ctrl+C to cancel)");
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Execute import
  console.log("\n🚀 IMPORTING...\n");
  
  const config: BulkImportConfig = {
    tiers: args.tiers,
    years: args.years,
    dryRun: args.dryRun,
    skipExisting: args.skipExisting,
    delayBetweenCalls: args.delay,
    stopOnError: false,
  };
  
  let lastProgressLog = 0;
  
  const result = await executeBulkImport(config, (progress) => {
    const now = Date.now();
    if (now - lastProgressLog > 5000 || progress.completed === progress.total) {
      const pct = Math.round((progress.completed / progress.total) * 100);
      const eta = progress.estimatedTimeRemaining 
        ? `ETA: ${Math.round(progress.estimatedTimeRemaining / 60)}m ${progress.estimatedTimeRemaining % 60}s`
        : "";
      console.log(
        `Progress: ${progress.completed}/${progress.total} (${pct}%) | ` +
        `✅ ${progress.success} | ⏭️ ${progress.skipped} | ❌ ${progress.failed} | ${eta}`
      );
      lastProgressLog = now;
    }
    
    if (args.verbose && progress.currentVehicle) {
      console.log(`  → ${progress.currentVehicle}`);
    }
  });
  
  // Print results
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  console.log(`Total processed: ${result.totalProcessed}`);
  console.log(`Imported:        ${result.imported}`);
  console.log(`Skipped:         ${result.skipped}`);
  console.log(`Failed:          ${result.failed}`);
  console.log(`Duration:        ${formatDuration(result.durationMs)}`);
  
  if (result.errors.length > 0) {
    console.log("\n❌ ERRORS:");
    for (const err of result.errors.slice(0, 20)) {
      console.log(`  - ${err.vehicle}: ${err.error}`);
    }
    if (result.errors.length > 20) {
      console.log(`  ... and ${result.errors.length - 20} more`);
    }
  }
  
  console.log("\n📊 COVERAGE AFTER IMPORT\n");
  console.log(`Total target vehicles: ${result.coverageAfter.totalTargetVehicles}`);
  console.log(`Populated in DB:       ${result.coverageAfter.populatedVehicles}`);
  console.log(`Coverage:              ${result.coverageAfter.coveragePercent}%`);
  console.log("");
  console.log(`📈 Estimated search coverage: ${result.coverageAfter.estimatedSearchCoverage}%`);
  console.log(`📉 Estimated API reduction:   ${result.coverageAfter.estimatedApiReduction}%`);
  
  console.log("\n✅ Done!\n");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// Run
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
