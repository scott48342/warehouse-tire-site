#!/usr/bin/env npx tsx
/**
 * BULK FITMENT IMPORT SCRIPT
 * 
 * Pre-populates vehicle_fitments table with high-demand vehicles.
 * 
 * Usage:
 *   npx tsx scripts/bulk-import-fitment.ts [options]
 * 
 * Options:
 *   --tier1           Import Tier 1 vehicles only
 *   --tier2           Import Tier 1 + Tier 2 vehicles
 *   --all             Import all tiers (default)
 *   --years=2024,2023 Specific years (default: 2010-2025)
 *   --dry-run         Show what would be imported
 *   --coverage        Just show coverage stats
 *   --skip-existing   Skip vehicles already in DB (default: true)
 *   --delay=1000      Delay between API calls in ms (default: 1000)
 *   --limit=10        Max vehicles to import (for testing)
 *   --help            Show help
 * 
 * @created 2026-03-27
 */

// Load env before any imports that use it
const fs = require("fs");
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

// Now import after env is set
const {
  calculateCoverage,
  printTargetSummary,
  getTotalTargetCount,
  getTargetVehicles,
  TIER_1_VEHICLES,
  TIER_2_VEHICLES,
  TIER_3_VEHICLES,
  IMPORT_YEARS,
} = require("../src/lib/fitment-db/bulkImportStrategy");

const { importVehicleFitment } = require("../src/lib/fitmentImport");
const { db, schema } = require("../src/lib/fitment-db/db");
const { sql } = require("drizzle-orm");

function parseArgs() {
  const args = process.argv.slice(2);
  
  let tiers: string[] = ["tier1", "tier2", "tier3"];
  let years = [...IMPORT_YEARS];
  let dryRun = false;
  let coverageOnly = false;
  let skipExisting = true;
  let delay = 1000;
  let limit: number | null = null;
  
  for (const arg of args) {
    if (arg === "--tier1") {
      tiers = ["tier1"];
    } else if (arg === "--tier2") {
      tiers = ["tier1", "tier2"];
    } else if (arg === "--all") {
      tiers = ["tier1", "tier2", "tier3"];
    } else if (arg.startsWith("--years=")) {
      const yearStr = arg.split("=")[1];
      years = yearStr.split(",").map((y: string) => parseInt(y.trim(), 10)).filter((y: number) => !isNaN(y));
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--coverage") {
      coverageOnly = true;
    } else if (arg === "--no-skip-existing") {
      skipExisting = false;
    } else if (arg.startsWith("--delay=")) {
      delay = parseInt(arg.split("=")[1], 10) || 1000;
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10) || null;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  
  return { tiers, years, dryRun, coverageOnly, skipExisting, delay, limit };
}

function printHelp() {
  console.log(`
BULK FITMENT IMPORT SCRIPT

Usage:
  npx tsx scripts/bulk-import-fitment.ts [options]

Options:
  --tier1             Import Tier 1 vehicles only (top 50)
  --tier2             Import Tier 1 + Tier 2 (top 150)
  --all               Import all tiers (default, ~200 vehicles)
  --years=2024,2023   Specific years (default: 2010-2025)
  --dry-run           Show what would be imported
  --coverage          Just show coverage stats
  --no-skip-existing  Re-import even if vehicle exists
  --delay=1000        Delay between API calls in ms (default: 1000)
  --limit=10          Max vehicles to import (for testing)
  --help              Show help

Examples:
  npx tsx scripts/bulk-import-fitment.ts --coverage
  npx tsx scripts/bulk-import-fitment.ts --tier1 --dry-run
  npx tsx scripts/bulk-import-fitment.ts --tier1 --years=2024,2023 --limit=5
  npx tsx scripts/bulk-import-fitment.ts --tier1 --years=2024
`);
}

async function checkVehicleExists(year: number, make: string, model: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM vehicle_fitments 
      WHERE year = ${year} 
        AND LOWER(make) = LOWER(${make})
        AND LOWER(model) = LOWER(${model})
      LIMIT 1
    `);
    return (result.rows?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("BULK FITMENT IMPORT");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  const args = parseArgs();
  
  if (!process.env.POSTGRES_URL) {
    console.error("❌ POSTGRES_URL not set. Make sure .env.local is configured.");
    process.exit(1);
  }
  
  // API key check happens later (only needed for actual imports)
  
  printTargetSummary();
  
  console.log("\n📊 CURRENT COVERAGE\n");
  
  try {
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
      console.log("\n✅ Coverage check complete (--coverage flag set)\n");
      process.exit(0);
    }
    
    // Build target list
    const targets = getTargetVehicles({ tiers: args.tiers, years: args.years });
    const vehiclesToProcess = args.limit ? targets.slice(0, args.limit) : targets;
    
    console.log("\n─────────────────────────────────────────────────────────────────────────────────");
    console.log("IMPORT CONFIGURATION\n");
    console.log(`Tiers:         ${args.tiers.join(", ")}`);
    console.log(`Years:         ${args.years.join(", ")}`);
    console.log(`Skip existing: ${args.skipExisting}`);
    console.log(`Delay:         ${args.delay}ms`);
    console.log(`Limit:         ${args.limit || "none"}`);
    console.log(`Dry run:       ${args.dryRun}`);
    console.log(`\nVehicles to process: ${vehiclesToProcess.length}`);
    
    if (args.dryRun) {
      console.log("\n🔍 DRY RUN MODE - showing first 20 vehicles:\n");
      for (const v of vehiclesToProcess.slice(0, 20)) {
        console.log(`  - ${v.year} ${v.make} ${v.model} (${v.tier})`);
      }
      if (vehiclesToProcess.length > 20) {
        console.log(`  ... and ${vehiclesToProcess.length - 20} more`);
      }
      console.log("\nTo run actual import, remove --dry-run flag\n");
      process.exit(0);
    }
    
    // Check API key before actual import
    if (!process.env.WHEELSIZE_API_KEY) {
      console.error("\n❌ WHEELSIZE_API_KEY not set. Required for importing fitment data.");
      console.log("Set it in .env.local or as an environment variable.\n");
      process.exit(1);
    }
    
    // Confirm before running
    const estimatedTime = (vehiclesToProcess.length * (args.delay + 500)) / 1000 / 60;
    console.log(`\nEstimated time: ~${estimatedTime.toFixed(0)} minutes`);
    console.log("\nStarting import in 3 seconds... (Ctrl+C to cancel)");
    await sleep(3000);
    
    // Execute import
    console.log("\n🚀 IMPORTING...\n");
    
    const startTime = Date.now();
    let success = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ vehicle: string; error: string }> = [];
    
    for (let i = 0; i < vehiclesToProcess.length; i++) {
      const v = vehiclesToProcess[i];
      const vehicleLabel = `${v.year} ${v.make} ${v.model}`;
      
      // Check if exists
      if (args.skipExisting) {
        const exists = await checkVehicleExists(v.year, v.make, v.model);
        if (exists) {
          skipped++;
          if ((i + 1) % 10 === 0 || i === vehiclesToProcess.length - 1) {
            const pct = Math.round(((i + 1) / vehiclesToProcess.length) * 100);
            console.log(`Progress: ${i + 1}/${vehiclesToProcess.length} (${pct}%) | ✅ ${success} | ⏭️ ${skipped} | ❌ ${failed}`);
          }
          continue;
        }
      }
      
      // Import
      try {
        console.log(`  → Importing: ${vehicleLabel}...`);
        const result = await importVehicleFitment(v.year, v.make, v.model, {
          usMarketOnly: true,
          debug: false,
        });
        
        if (result.success) {
          success++;
          console.log(`    ✅ Success: ${result.wheelSpecsCount} wheel specs imported`);
        } else {
          failed++;
          const errMsg = result.error || "Unknown error";
          errors.push({ vehicle: vehicleLabel, error: errMsg });
          console.log(`    ❌ Failed: ${errMsg}`);
        }
      } catch (err: any) {
        failed++;
        const errMsg = err?.message || String(err);
        errors.push({ vehicle: vehicleLabel, error: errMsg });
        console.log(`    ❌ Error: ${errMsg}`);
      }
      
      // Progress update
      if ((i + 1) % 10 === 0 || i === vehiclesToProcess.length - 1) {
        const pct = Math.round(((i + 1) / vehiclesToProcess.length) * 100);
        const elapsed = Date.now() - startTime;
        const avgTime = elapsed / (i + 1);
        const remaining = (vehiclesToProcess.length - i - 1) * avgTime;
        console.log(`Progress: ${i + 1}/${vehiclesToProcess.length} (${pct}%) | ✅ ${success} | ⏭️ ${skipped} | ❌ ${failed} | ETA: ${formatDuration(remaining)}`);
      }
      
      // Rate limiting
      if (i < vehiclesToProcess.length - 1) {
        await sleep(args.delay);
      }
    }
    
    // Final results
    const totalTime = Date.now() - startTime;
    
    console.log("\n═══════════════════════════════════════════════════════════════════════════════");
    console.log("IMPORT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════════════════════\n");
    
    console.log(`Total processed: ${vehiclesToProcess.length}`);
    console.log(`Imported:        ${success}`);
    console.log(`Skipped:         ${skipped}`);
    console.log(`Failed:          ${failed}`);
    console.log(`Duration:        ${formatDuration(totalTime)}`);
    
    if (errors.length > 0) {
      console.log("\n❌ ERRORS (first 10):");
      for (const err of errors.slice(0, 10)) {
        console.log(`  - ${err.vehicle}: ${err.error}`);
      }
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more`);
      }
    }
    
    // Final coverage
    console.log("\n📊 COVERAGE AFTER IMPORT\n");
    const finalCoverage = await calculateCoverage();
    console.log(`Total target vehicles: ${finalCoverage.totalTargetVehicles}`);
    console.log(`Populated in DB:       ${finalCoverage.populatedVehicles}`);
    console.log(`Coverage:              ${finalCoverage.coveragePercent}%`);
    console.log(`\n📈 Estimated search coverage: ${finalCoverage.estimatedSearchCoverage}%`);
    console.log(`📉 Estimated API reduction:   ${finalCoverage.estimatedApiReduction}%`);
    
    console.log("\n✅ Done!\n");
    
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
