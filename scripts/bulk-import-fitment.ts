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
  TIER_1_VEHICLES,
  TIER_2_VEHICLES,
  TIER_3_VEHICLES,
  IMPORT_YEARS,
} = require("../src/lib/fitment-db/bulkImportStrategy");

function parseArgs() {
  const args = process.argv.slice(2);
  
  let tiers: string[] = ["tier1", "tier2", "tier3"];
  let years = [...IMPORT_YEARS];
  let dryRun = false;
  let coverageOnly = false;
  
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
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  
  return { tiers, years, dryRun, coverageOnly };
}

function printHelp() {
  console.log(`
BULK FITMENT IMPORT SCRIPT

Usage:
  npx tsx scripts/bulk-import-fitment.ts [options]

Options:
  --tier1           Import Tier 1 vehicles only (top 50)
  --tier2           Import Tier 1 + Tier 2 (top 150)
  --all             Import all tiers (default, ~200 vehicles)
  --years=2024,2023 Specific years (default: 2010-2025)
  --dry-run         Show what would be imported
  --coverage        Just show coverage stats
  --help            Show help

Examples:
  npx tsx scripts/bulk-import-fitment.ts --coverage
  npx tsx scripts/bulk-import-fitment.ts --tier1 --dry-run
`);
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
    
    // Show what would be imported
    console.log("\n─────────────────────────────────────────────────────────────────────────────────");
    console.log("IMPORT CONFIGURATION\n");
    console.log(`Tiers:   ${args.tiers.join(", ")}`);
    console.log(`Years:   ${args.years.join(", ")}`);
    console.log(`Dry run: ${args.dryRun}`);
    
    if (args.dryRun) {
      console.log("\n🔍 DRY RUN MODE - No actual imports");
      console.log("\nTo run actual import, remove --dry-run flag\n");
    } else {
      console.log("\n⚠️  Actual import not implemented in this version.");
      console.log("Use the API endpoint or implement executeBulkImport().\n");
    }
    
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
