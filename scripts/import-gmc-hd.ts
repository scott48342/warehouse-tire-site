/**
 * Import GMC HD Truck Fitment Data
 * 
 * Adds missing fitment data for:
 * - GMC Sierra 2500 HD (2024, 2025)
 * - GMC Sierra 3500 HD (2024, 2025)
 * 
 * Same platform as Chevy Silverado HD - 8x180mm bolt pattern
 * 
 * Run: npx tsx scripts/import-gmc-hd.ts
 */

import { importFromJson } from "../src/lib/fitment-db/fitmentManualImport";

interface FitmentRecord {
  year: number;
  make: string;
  model: string;
  trim: string;
  displayTrim: string;
  boltPattern: string;
  centerBoreMm: number;
  threadSize: string;
  seatType: string;
  offsetMinMm: number;
  offsetMaxMm: number;
  oemTireSizes: string[];
  source: string;
  sourceNotes: string;
  confidence: "high" | "medium" | "low";
}

// GMC HD specs (2024-2025) - Same as Chevy Silverado HD
// 8x180mm bolt pattern, 124.1mm center bore, M14x1.5 thread
const gmcHdBase = {
  boltPattern: "8x180",
  centerBoreMm: 124.1,
  threadSize: "M14x1.5",
  seatType: "conical",
  offsetMinMm: 35,
  offsetMaxMm: 55,
  source: "generation-baseline",
  sourceNotes: "GMC Sierra HD (GMT T1XX platform, same as Silverado HD) - manually added for lifted validation",
  confidence: "high" as const,
};

const records: FitmentRecord[] = [];

// GMC Sierra 2500 HD (2024, 2025)
const sierra2500Trims = [
  { trim: "Pro", displayTrim: "Pro" },
  { trim: "SLE", displayTrim: "SLE" },
  { trim: "SLT", displayTrim: "SLT" },
  { trim: "AT4", displayTrim: "AT4" },
  { trim: "Denali", displayTrim: "Denali" },
  { trim: "Denali Ultimate", displayTrim: "Denali Ultimate" },
];

for (const year of [2024, 2025]) {
  for (const t of sierra2500Trims) {
    records.push({
      year,
      make: "GMC",
      model: "Sierra 2500 HD",
      trim: t.trim,
      displayTrim: t.displayTrim,
      ...gmcHdBase,
      oemTireSizes: ["265/70R18", "275/65R20", "LT275/70R18"],
    });
  }
}

// GMC Sierra 3500 HD (2024, 2025)
const sierra3500Trims = [
  { trim: "Pro", displayTrim: "Pro" },
  { trim: "SLE", displayTrim: "SLE" },
  { trim: "SLT", displayTrim: "SLT" },
  { trim: "AT4", displayTrim: "AT4" },
  { trim: "Denali", displayTrim: "Denali" },
];

for (const year of [2024, 2025]) {
  for (const t of sierra3500Trims) {
    records.push({
      year,
      make: "GMC",
      model: "Sierra 3500 HD",
      trim: t.trim,
      displayTrim: t.displayTrim,
      ...gmcHdBase,
      oemTireSizes: ["265/70R18", "275/65R20", "LT275/70R18"],
    });
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORTING GMC HD TRUCK FITMENT DATA");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`Total records to import: ${records.length}`);
  console.log("");
  
  const summary: Record<string, number> = {};
  for (const r of records) {
    const key = `${r.make} ${r.model}`;
    summary[key] = (summary[key] || 0) + 1;
  }
  
  console.log("Records by vehicle:");
  for (const [vehicle, count] of Object.entries(summary)) {
    console.log(`  ${vehicle}: ${count} records`);
  }
  console.log("");
  
  console.log("Importing...");
  const result = await importFromJson(records);
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORT RESULTS");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log(`Total:    ${result.total}`);
  console.log(`Inserted: ${result.inserted}`);
  console.log(`Updated:  ${result.updated}`);
  console.log(`Skipped:  ${result.skipped}`);
  console.log(`Failed:   ${result.failed}`);
  
  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const err of result.errors) {
      console.log(`  Row ${err.row}: ${err.vehicle} - ${err.error}`);
    }
  }
  
  console.log("");
  console.log(result.success ? "✅ Import completed successfully!" : "❌ Import completed with errors");
  
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
