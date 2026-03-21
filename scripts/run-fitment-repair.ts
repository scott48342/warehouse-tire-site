#!/usr/bin/env npx tsx
/**
 * Fitment Repair CLI
 * 
 * Scans for invalid/partial fitment records and attempts to repair them
 * by re-fetching from the Wheel-Size API.
 * 
 * Usage:
 *   npx tsx scripts/run-fitment-repair.ts [options]
 * 
 * Options:
 *   --dry-run     Scan only, don't repair
 *   --limit=N     Max records to process (default: 50)
 *   --year-min=N  Filter by minimum year
 *   --year-max=N  Filter by maximum year
 *   --make=NAME   Filter by make (e.g., "chevrolet")
 *   --delay=N     Delay between API calls in ms (default: 500)
 *   --format=FMT  Output format: json or text (default: text)
 * 
 * Examples:
 *   npx tsx scripts/run-fitment-repair.ts --dry-run --limit=100
 *   npx tsx scripts/run-fitment-repair.ts --make=chevrolet --year-min=2000 --year-max=2010
 *   npx tsx scripts/run-fitment-repair.ts --limit=20 --format=json
 */

import {
  runRepairSweep,
  getQualityBreakdown,
  formatReportAsText,
} from "../src/lib/fitment-db/repairService";

// Parse CLI args
function parseArgs(): {
  dryRun: boolean;
  limit: number;
  yearMin?: number;
  yearMax?: number;
  make?: string;
  delayMs: number;
  format: "json" | "text";
  help: boolean;
} {
  const args = process.argv.slice(2);
  
  const options = {
    dryRun: false,
    limit: 50,
    yearMin: undefined as number | undefined,
    yearMax: undefined as number | undefined,
    make: undefined as string | undefined,
    delayMs: 500,
    format: "text" as "json" | "text",
    help: false,
  };
  
  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--limit=")) options.limit = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--year-min=")) options.yearMin = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--year-max=")) options.yearMax = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--make=")) options.make = arg.split("=")[1];
    else if (arg.startsWith("--delay=")) options.delayMs = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--format=")) options.format = arg.split("=")[1] as "json" | "text";
  }
  
  return options;
}

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    console.log(`
Fitment Repair CLI

Scans for invalid/partial fitment records and attempts to repair them
by re-fetching from the Wheel-Size API.

Usage:
  npx tsx scripts/run-fitment-repair.ts [options]

Options:
  --dry-run     Scan only, don't repair
  --limit=N     Max records to process (default: 50)
  --year-min=N  Filter by minimum year
  --year-max=N  Filter by maximum year
  --make=NAME   Filter by make (e.g., "chevrolet")
  --delay=N     Delay between API calls in ms (default: 500)
  --format=FMT  Output format: json or text (default: text)
  --help, -h    Show this help

Examples:
  # Dry run to see what would be repaired
  npx tsx scripts/run-fitment-repair.ts --dry-run --limit=100

  # Repair Chevrolet vehicles from 2000-2010
  npx tsx scripts/run-fitment-repair.ts --make=chevrolet --year-min=2000 --year-max=2010

  # Quick scan with JSON output
  npx tsx scripts/run-fitment-repair.ts --limit=20 --format=json
`);
    process.exit(0);
  }
  
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("                    FITMENT REPAIR SWEEP");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Options:");
  console.log(`  Dry Run:   ${options.dryRun}`);
  console.log(`  Limit:     ${options.limit}`);
  console.log(`  Year Min:  ${options.yearMin || "(any)"}`);
  console.log(`  Year Max:  ${options.yearMax || "(any)"}`);
  console.log(`  Make:      ${options.make || "(any)"}`);
  console.log(`  Delay:     ${options.delayMs}ms`);
  console.log(`  Format:    ${options.format}`);
  console.log("");
  
  // First show current breakdown
  console.log("Fetching current quality breakdown...\n");
  const breakdown = await getQualityBreakdown();
  
  console.log("Current State:");
  console.log(`  Total:   ${breakdown.total}`);
  console.log(`  Valid:   ${breakdown.valid} (${((breakdown.valid / breakdown.total) * 100).toFixed(1)}%)`);
  console.log(`  Partial: ${breakdown.partial} (${((breakdown.partial / breakdown.total) * 100).toFixed(1)}%)`);
  console.log(`  Invalid: ${breakdown.invalid} (${((breakdown.invalid / breakdown.total) * 100).toFixed(1)}%)`);
  console.log("");
  
  // Run repair sweep
  console.log("Starting repair sweep...\n");
  
  const report = await runRepairSweep({
    limit: options.limit,
    dryRun: options.dryRun,
    yearMin: options.yearMin,
    yearMax: options.yearMax,
    make: options.make,
    delayMs: options.delayMs,
  });
  
  // Output report
  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReportAsText(report));
  }
  
  // Exit with appropriate code
  if (report.summary.errors > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
