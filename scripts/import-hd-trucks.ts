/**
 * Import HD Truck Fitment Data
 * 
 * Adds missing fitment data for:
 * - Ford F-250 (2024, 2025)
 * - Ford F-350 (2024, 2025)
 * - Chevrolet Silverado 2500 HD (2024, 2025)
 * - Chevrolet Silverado 3500 HD (2024, 2025)
 * - Nissan Titan XD (2023, 2024)
 * 
 * Run: npx tsx scripts/import-hd-trucks.ts
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

// Ford Super Duty specs (2024-2025)
// 8x170mm bolt pattern, 124.9mm center bore, M14x2.0 thread
const fordSuperDutyBase = {
  boltPattern: "8x170",
  centerBoreMm: 124.9,
  threadSize: "M14x2.0",
  seatType: "conical",
  offsetMinMm: 25,
  offsetMaxMm: 60,
  source: "generation-baseline",
  sourceNotes: "Ford Super Duty 5th gen (2023+) - manually added for lifted validation",
  confidence: "high" as const,
};

// Chevy HD specs (2024-2025)
// 8x180mm bolt pattern, 124.1mm center bore, M14x1.5 thread
const chevyHdBase = {
  boltPattern: "8x180",
  centerBoreMm: 124.1,
  threadSize: "M14x1.5",
  seatType: "conical",
  offsetMinMm: 35,
  offsetMaxMm: 55,
  source: "generation-baseline",
  sourceNotes: "Chevy Silverado HD 5th gen (2020+) - manually added for lifted validation",
  confidence: "high" as const,
};

// Nissan Titan XD specs (2023-2024)
// 6x139.7mm bolt pattern, 78.1mm center bore, M14x1.5 thread
const titanXdBase = {
  boltPattern: "6x139.7",
  centerBoreMm: 78.1,
  threadSize: "M14x1.5",
  seatType: "conical",
  offsetMinMm: 18,
  offsetMaxMm: 45,
  source: "generation-baseline",
  sourceNotes: "Nissan Titan XD 2nd gen - manually added for lifted validation",
  confidence: "high" as const,
};

// Build all records
const records: FitmentRecord[] = [];

// Ford F-250 (2024, 2025) - multiple trims
const f250Trims = [
  { trim: "XL", displayTrim: "XL" },
  { trim: "XLT", displayTrim: "XLT" },
  { trim: "Lariat", displayTrim: "Lariat" },
  { trim: "King Ranch", displayTrim: "King Ranch" },
  { trim: "Platinum", displayTrim: "Platinum" },
  { trim: "Limited", displayTrim: "Limited" },
  { trim: "Tremor", displayTrim: "Tremor" },
];

for (const year of [2024, 2025]) {
  for (const t of f250Trims) {
    records.push({
      year,
      make: "Ford",
      model: "F-250",
      trim: t.trim,
      displayTrim: t.displayTrim,
      ...fordSuperDutyBase,
      oemTireSizes: ["275/70R18", "LT275/65R20", "275/65R20"],
    });
  }
}

// Ford F-350 (2024, 2025) - multiple trims
const f350Trims = [
  { trim: "XL", displayTrim: "XL" },
  { trim: "XLT", displayTrim: "XLT" },
  { trim: "Lariat", displayTrim: "Lariat" },
  { trim: "King Ranch", displayTrim: "King Ranch" },
  { trim: "Platinum", displayTrim: "Platinum" },
  { trim: "Limited", displayTrim: "Limited" },
];

for (const year of [2024, 2025]) {
  for (const t of f350Trims) {
    records.push({
      year,
      make: "Ford",
      model: "F-350",
      trim: t.trim,
      displayTrim: t.displayTrim,
      ...fordSuperDutyBase,
      oemTireSizes: ["275/70R18", "LT275/65R20", "LT275/70R18"],
    });
  }
}

// Chevrolet Silverado 2500 HD (2024, 2025)
const silverado2500Trims = [
  { trim: "WT", displayTrim: "Work Truck" },
  { trim: "Custom", displayTrim: "Custom" },
  { trim: "LT", displayTrim: "LT" },
  { trim: "LTZ", displayTrim: "LTZ" },
  { trim: "High Country", displayTrim: "High Country" },
  { trim: "ZR2", displayTrim: "ZR2" },
];

for (const year of [2024, 2025]) {
  for (const t of silverado2500Trims) {
    records.push({
      year,
      make: "Chevrolet",
      model: "Silverado 2500 HD",
      trim: t.trim,
      displayTrim: t.displayTrim,
      ...chevyHdBase,
      oemTireSizes: ["265/70R18", "275/65R20", "LT275/70R18"],
    });
  }
}

// Chevrolet Silverado 3500 HD (2024, 2025)
const silverado3500Trims = [
  { trim: "WT", displayTrim: "Work Truck" },
  { trim: "LT", displayTrim: "LT" },
  { trim: "LTZ", displayTrim: "LTZ" },
  { trim: "High Country", displayTrim: "High Country" },
];

for (const year of [2024, 2025]) {
  for (const t of silverado3500Trims) {
    records.push({
      year,
      make: "Chevrolet",
      model: "Silverado 3500 HD",
      trim: t.trim,
      displayTrim: t.displayTrim,
      ...chevyHdBase,
      oemTireSizes: ["265/70R18", "275/65R20", "LT275/70R18"],
    });
  }
}

// Nissan Titan XD (2023, 2024)
const titanXdTrims = [
  { trim: "S", displayTrim: "S" },
  { trim: "SV", displayTrim: "SV" },
  { trim: "PRO-4X", displayTrim: "PRO-4X" },
  { trim: "Platinum Reserve", displayTrim: "Platinum Reserve" },
];

for (const year of [2023, 2024]) {
  for (const t of titanXdTrims) {
    records.push({
      year,
      make: "Nissan",
      model: "Titan XD",
      trim: t.trim,
      displayTrim: t.displayTrim,
      ...titanXdBase,
      oemTireSizes: ["275/60R20", "275/65R20", "LT275/65R20"],
    });
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORTING HD TRUCK FITMENT DATA");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`Total records to import: ${records.length}`);
  console.log("");
  
  // Summary by vehicle
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
  
  // Import
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
