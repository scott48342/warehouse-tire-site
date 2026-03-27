#!/usr/bin/env npx tsx
/**
 * BULK FITMENT IMPORT SCRIPT (No Wheel-Size)
 * 
 * Imports fitment data from CSV/JSON files.
 * Does NOT use Wheel-Size API.
 * 
 * Usage:
 *   npx tsx scripts/bulk-import-fitment.ts [options]
 * 
 * Options:
 *   --file=path.csv     Import from CSV file
 *   --json=path.json    Import from JSON file
 *   --validate          Validate only, don't insert
 *   --coverage          Just show coverage stats
 *   --example           Show example formats
 *   --help              Show help
 * 
 * @created 2026-03-27
 */

// Load env before any imports
const fs = require("fs");
const path = require("path");

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
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

// Now import after env is set
const {
  calculateCoverage,
  printTargetSummary,
  TIER_1_VEHICLES,
  TIER_2_VEHICLES,
  TIER_3_VEHICLES,
  IMPORT_YEARS,
} = require("../src/lib/fitment-db/bulkImportStrategy");

const {
  importFromJson,
  importFromCsv,
  getExampleCsv,
  getExampleJson,
} = require("../src/lib/fitment-db/fitmentManualImport");

function parseArgs() {
  const args = process.argv.slice(2);
  
  let csvFile: string | null = null;
  let jsonFile: string | null = null;
  let validateOnly = false;
  let coverageOnly = false;
  let showExample = false;
  
  for (const arg of args) {
    if (arg.startsWith("--file=") || arg.startsWith("--csv=")) {
      csvFile = arg.split("=")[1];
    } else if (arg.startsWith("--json=")) {
      jsonFile = arg.split("=")[1];
    } else if (arg === "--validate") {
      validateOnly = true;
    } else if (arg === "--coverage") {
      coverageOnly = true;
    } else if (arg === "--example") {
      showExample = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  
  return { csvFile, jsonFile, validateOnly, coverageOnly, showExample };
}

function printHelp() {
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
BULK FITMENT IMPORT (No Wheel-Size)
═══════════════════════════════════════════════════════════════════════════════

Import fitment data from CSV or JSON files.
Does NOT use Wheel-Size API.

Usage:
  npx tsx scripts/bulk-import-fitment.ts [options]

Options:
  --file=path.csv     Import from CSV file
  --json=path.json    Import from JSON file
  --validate          Validate only, don't insert
  --coverage          Just show coverage stats
  --example           Show example CSV/JSON formats
  --help              Show help

Examples:
  npx tsx scripts/bulk-import-fitment.ts --coverage
  npx tsx scripts/bulk-import-fitment.ts --example
  npx tsx scripts/bulk-import-fitment.ts --file=fitments.csv --validate
  npx tsx scripts/bulk-import-fitment.ts --file=fitments.csv
  npx tsx scripts/bulk-import-fitment.ts --json=fitments.json
`);
}

function printExamples() {
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("EXAMPLE FORMATS");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  console.log("CSV FORMAT:");
  console.log("─────────────────────────────────────────────────────────────────────────────────");
  console.log(getExampleCsv());
  
  console.log("\nJSON FORMAT:");
  console.log("─────────────────────────────────────────────────────────────────────────────────");
  console.log(JSON.stringify(getExampleJson(), null, 2));
  
  console.log("\n─────────────────────────────────────────────────────────────────────────────────");
  console.log("REQUIRED FIELDS: year, make, model, boltPattern, centerBoreMm, source");
  console.log("OPTIONAL FIELDS: trim, displayTrim, submodel, threadSize, seatType,");
  console.log("                 wheelDiameterMin/Max, wheelWidthMin/Max, offsetMinMm/MaxMm,");
  console.log("                 oemWheelSizes, oemTireSizes, sourceNotes, confidence");
  console.log("\nVALID SEAT TYPES: conical, ball, flat, mag");
  console.log("VALID CONFIDENCE: high, medium, low\n");
}

async function showCoverage() {
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("FITMENT COVERAGE REPORT");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  printTargetSummary();
  
  const coverage = await calculateCoverage();
  
  console.log("\n📊 CURRENT COVERAGE\n");
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
  console.log("");
}

async function importFile(filePath: string, isJson: boolean, validateOnly: boolean) {
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log(`IMPORTING: ${filePath}`);
  console.log(`Mode: ${isJson ? "JSON" : "CSV"} | Validate only: ${validateOnly}`);
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  // Check file exists
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ File not found: ${absPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(absPath, "utf-8");
  
  let result;
  if (isJson) {
    const records = JSON.parse(content);
    const recordsArray = Array.isArray(records) ? records : [records];
    result = await importFromJson(recordsArray, { validateOnly });
  } else {
    result = await importFromCsv(content, { validateOnly });
  }
  
  console.log("📊 IMPORT RESULTS\n");
  console.log(`Total records:  ${result.total}`);
  console.log(`Inserted:       ${result.inserted}`);
  console.log(`Updated:        ${result.updated}`);
  console.log(`Skipped:        ${result.skipped}`);
  console.log(`Failed:         ${result.failed}`);
  
  if (result.errors.length > 0) {
    console.log("\n❌ ERRORS:");
    for (const err of result.errors.slice(0, 20)) {
      console.log(`  Row ${err.row}: ${err.vehicle} - ${err.error}`);
    }
    if (result.errors.length > 20) {
      console.log(`  ... and ${result.errors.length - 20} more`);
    }
  }
  
  if (!validateOnly && result.inserted + result.updated > 0) {
    console.log("\n📊 COVERAGE AFTER IMPORT\n");
    const coverage = await calculateCoverage();
    console.log(`Total target vehicles: ${coverage.totalTargetVehicles}`);
    console.log(`Populated in DB:       ${coverage.populatedVehicles}`);
    console.log(`Coverage:              ${coverage.coveragePercent}%`);
    console.log(`\n📈 Estimated search coverage: ${coverage.estimatedSearchCoverage}%`);
  }
  
  console.log("\n✅ Done!\n");
  return result.success;
}

async function main() {
  const args = parseArgs();
  
  if (!process.env.POSTGRES_URL) {
    console.error("❌ POSTGRES_URL not set. Make sure .env.local is configured.");
    process.exit(1);
  }
  
  if (args.showExample) {
    printExamples();
    process.exit(0);
  }
  
  if (args.coverageOnly) {
    await showCoverage();
    process.exit(0);
  }
  
  if (args.csvFile) {
    const success = await importFile(args.csvFile, false, args.validateOnly);
    process.exit(success ? 0 : 1);
  }
  
  if (args.jsonFile) {
    const success = await importFile(args.jsonFile, true, args.validateOnly);
    process.exit(success ? 0 : 1);
  }
  
  // No file specified, show help
  printHelp();
  console.log("No file specified. Use --file=path.csv or --json=path.json to import data.\n");
  console.log("To see example formats: npx tsx scripts/bulk-import-fitment.ts --example\n");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
