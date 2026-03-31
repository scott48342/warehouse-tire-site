/**
 * Import Mercedes-Benz Fitment Data - Phase 1
 * 
 * Models: C-Class, E-Class, GLC
 * 
 * STAGGERED FITMENT AWARENESS:
 * - Many Mercedes trims have staggered (front/rear different) setups
 * - AMG models almost always staggered
 * - Base trims often square but options vary
 * - We list ALL OEM sizes (both square and staggered options)
 * 
 * GENERATION ISOLATION:
 * - C-Class W205 (2015-2021) vs W206 (2022+)
 * - E-Class W213 (2017-2023) vs W214 (2024+)
 * - GLC X253 (2016-2022) vs X254 (2023+)
 * 
 * All Mercedes use:
 * - 5x112 bolt pattern
 * - 66.6mm center bore
 * - M14x1.5 thread, ball seat
 * 
 * Run: npx tsx scripts/import-mercedes.ts
 */

import { importFromJson, type FitmentInput } from "../src/lib/fitment-db/fitmentManualImport";

const records: FitmentInput[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// MERCEDES BASE SPECS
// ═══════════════════════════════════════════════════════════════════════════════

const mercedesBase = {
  boltPattern: "5x112",
  centerBoreMm: 66.6,
  threadSize: "M14x1.5",
  seatType: "ball", // Mercedes uses ball seat, not conical!
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function addYearRange(
  model: string,
  yearStart: number,
  yearEnd: number,
  trims: Array<{ trim: string; displayTrim: string; staggered?: boolean }>,
  specs: Partial<FitmentInput>
) {
  for (let year = yearStart; year <= yearEnd; year++) {
    for (const t of trims) {
      const sourceNotes = t.staggered 
        ? `${specs.sourceNotes} - STAGGERED FITMENT AVAILABLE`
        : specs.sourceNotes as string;
      
      // NOTE: Use "mercedes" (not "mercedes-benz") to match keys.ts normalization
      records.push({
        year,
        make: "mercedes",
        model,
        trim: t.trim,
        displayTrim: t.displayTrim,
        source: "generation-baseline",
        confidence: "high",
        ...mercedesBase,
        ...specs,
        sourceNotes,
      } as FitmentInput);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// C-CLASS W206 (2022-2025) - Current Generation
// ═══════════════════════════════════════════════════════════════════════════════

const cClassW206Trims = [
  { trim: "C 300", displayTrim: "C 300", staggered: false },
  { trim: "C 300 4MATIC", displayTrim: "C 300 4MATIC", staggered: false },
  { trim: "AMG C 43", displayTrim: "AMG C 43 4MATIC", staggered: true },
  { trim: "AMG C 63 S", displayTrim: "AMG C 63 S E Performance", staggered: true },
];

addYearRange("C-Class", 2022, 2025, cClassW206Trims, {
  offsetMinMm: 43,
  offsetMaxMm: 52,
  // Include both square and staggered options
  oemTireSizes: [
    "225/45R18",      // Base square
    "245/40R18",      // Staggered rear option
    "225/40R19",      // 19" front
    "255/35R19",      // 19" staggered rear
    "245/35R20",      // AMG front
    "275/30R20",      // AMG rear
  ],
  sourceNotes: "C-Class W206 (2022+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// C-CLASS W205 (2015-2021) - Previous Generation
// ═══════════════════════════════════════════════════════════════════════════════

const cClassW205Trims = [
  { trim: "C 300", displayTrim: "C 300", staggered: false },
  { trim: "C 300 4MATIC", displayTrim: "C 300 4MATIC", staggered: false },
  { trim: "C 350e", displayTrim: "C 350e Plug-In Hybrid", staggered: false },
  { trim: "C 400 4MATIC", displayTrim: "C 400 4MATIC", staggered: false },
  { trim: "C 450 AMG", displayTrim: "C 450 AMG 4MATIC", staggered: true },
  { trim: "AMG C 43", displayTrim: "AMG C 43 4MATIC", staggered: true },
  { trim: "AMG C 63", displayTrim: "AMG C 63", staggered: true },
  { trim: "AMG C 63 S", displayTrim: "AMG C 63 S", staggered: true },
];

addYearRange("C-Class", 2015, 2021, cClassW205Trims, {
  offsetMinMm: 43,
  offsetMaxMm: 52,
  oemTireSizes: [
    "205/60R16",      // Base
    "225/50R17",      // Sport
    "225/45R18",      // 18" square
    "245/40R18",      // 18" staggered rear
    "225/40R19",      // 19" front
    "255/35R19",      // 19" staggered rear
    "255/35R19",      // AMG C63 front
    "285/30R19",      // AMG C63 rear
    "255/30R20",      // AMG C63 S front
    "285/25R20",      // AMG C63 S rear
  ],
  sourceNotes: "C-Class W205 (2015-2021)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// E-CLASS W214 (2024-2025) - Current Generation
// ═══════════════════════════════════════════════════════════════════════════════

const eClassW214Trims = [
  { trim: "E 350", displayTrim: "E 350 4MATIC", staggered: false },
  { trim: "E 450", displayTrim: "E 450 4MATIC", staggered: false },
  { trim: "AMG E 53", displayTrim: "AMG E 53", staggered: true },
];

addYearRange("E-Class", 2024, 2025, eClassW214Trims, {
  offsetMinMm: 38,
  offsetMaxMm: 48,
  oemTireSizes: [
    "225/55R18",      // Base
    "245/45R19",      // Sport
    "245/40R20",      // 20" option front
    "275/35R20",      // 20" staggered rear
    "265/35R21",      // AMG front
    "295/30R21",      // AMG rear
  ],
  sourceNotes: "E-Class W214 (2024+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// E-CLASS W213 (2017-2023) - Previous Generation
// ═══════════════════════════════════════════════════════════════════════════════

const eClassW213Trims = [
  { trim: "E 300", displayTrim: "E 300", staggered: false },
  { trim: "E 300 4MATIC", displayTrim: "E 300 4MATIC", staggered: false },
  { trim: "E 350", displayTrim: "E 350 4MATIC", staggered: false },
  { trim: "E 400 4MATIC", displayTrim: "E 400 4MATIC", staggered: false },
  { trim: "E 450", displayTrim: "E 450 4MATIC", staggered: false },
  { trim: "E 53 AMG", displayTrim: "AMG E 53 4MATIC+", staggered: true },
  { trim: "E 63 AMG", displayTrim: "AMG E 63", staggered: true },
  { trim: "E 63 S AMG", displayTrim: "AMG E 63 S", staggered: true },
];

addYearRange("E-Class", 2017, 2023, eClassW213Trims, {
  offsetMinMm: 38,
  offsetMaxMm: 48,
  oemTireSizes: [
    "225/55R17",      // Base
    "245/45R18",      // Sport
    "245/40R19",      // 19" square
    "275/35R19",      // 19" staggered rear
    "245/35R20",      // 20" front
    "275/30R20",      // 20" staggered rear
    "265/35R20",      // AMG E63 front
    "295/30R20",      // AMG E63 rear
  ],
  sourceNotes: "E-Class W213 (2017-2023)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLC X254 (2023-2025) - Current Generation
// ═══════════════════════════════════════════════════════════════════════════════

const glcX254Trims = [
  { trim: "GLC 300", displayTrim: "GLC 300 4MATIC", staggered: false },
  { trim: "GLC 350e", displayTrim: "GLC 350e 4MATIC", staggered: false },
  { trim: "AMG GLC 43", displayTrim: "AMG GLC 43 4MATIC", staggered: true },
  { trim: "AMG GLC 63 S", displayTrim: "AMG GLC 63 S E Performance", staggered: true },
];

addYearRange("GLC", 2023, 2025, glcX254Trims, {
  offsetMinMm: 38,
  offsetMaxMm: 50,
  oemTireSizes: [
    "235/65R17",      // Base
    "235/55R19",      // Sport square
    "255/45R20",      // 20" option
    "255/40R21",      // 21" front
    "285/35R21",      // 21" staggered rear
  ],
  sourceNotes: "GLC X254 (2023+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLC X253 (2016-2022) - Previous Generation  
// ═══════════════════════════════════════════════════════════════════════════════

const glcX253Trims = [
  { trim: "GLC 300", displayTrim: "GLC 300", staggered: false },
  { trim: "GLC 300 4MATIC", displayTrim: "GLC 300 4MATIC", staggered: false },
  { trim: "GLC 350e", displayTrim: "GLC 350e 4MATIC", staggered: false },
  { trim: "AMG GLC 43", displayTrim: "AMG GLC 43 4MATIC", staggered: true },
  { trim: "AMG GLC 63", displayTrim: "AMG GLC 63 4MATIC+", staggered: true },
  { trim: "AMG GLC 63 S", displayTrim: "AMG GLC 63 S 4MATIC+", staggered: true },
];

addYearRange("GLC", 2016, 2022, glcX253Trims, {
  offsetMinMm: 38,
  offsetMaxMm: 50,
  oemTireSizes: [
    "235/65R17",      // Base
    "235/60R18",      // 18" option
    "235/55R19",      // 19" square
    "255/45R20",      // 20" square
    "255/40R21",      // 21" front
    "285/35R21",      // 21" staggered rear
    "265/40R21",      // AMG GLC 63 front
    "295/35R21",      // AMG GLC 63 rear
  ],
  sourceNotes: "GLC X253 (2016-2022)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORTING MERCEDES-BENZ FITMENT DATA - PHASE 1");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`Total records to import: ${records.length}`);
  console.log("");
  
  // Summary by model and generation
  const summary: Record<string, { count: number; years: Set<number> }> = {};
  for (const r of records) {
    const year = r.year as number;
    const model = r.model as string;
    // Group by model + generation
    let genKey = model;
    if (model === "C-Class") {
      genKey = year >= 2022 ? "C-Class W206 (2022+)" : "C-Class W205 (2015-2021)";
    } else if (model === "E-Class") {
      genKey = year >= 2024 ? "E-Class W214 (2024+)" : "E-Class W213 (2017-2023)";
    } else if (model === "GLC") {
      genKey = year >= 2023 ? "GLC X254 (2023+)" : "GLC X253 (2016-2022)";
    }
    
    if (!summary[genKey]) summary[genKey] = { count: 0, years: new Set() };
    summary[genKey].count++;
    summary[genKey].years.add(year);
  }
  
  console.log("Records by model/generation:");
  for (const [gen, data] of Object.entries(summary)) {
    const years = Array.from(data.years).sort();
    console.log(`  ${gen}: ${data.count} records (${years[0]}-${years[years.length - 1]})`);
  }
  console.log("");
  
  // Count staggered trims
  const staggeredCount = records.filter(r => 
    (r.sourceNotes as string)?.includes("STAGGERED")
  ).length;
  console.log(`Staggered fitment trims: ${staggeredCount}/${records.length} (${Math.round(staggeredCount/records.length*100)}%)`);
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
    console.log("Errors (first 10):");
    for (const err of result.errors.slice(0, 10)) {
      console.log(`  Row ${err.row}: ${err.vehicle} - ${err.error}`);
    }
  }
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORTANT NOTES");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("✓ Mercedes uses BALL SEAT (not conical like most)");
  console.log("✓ AMG trims have staggered fitment (F/R different sizes)");
  console.log("✓ All OEM sizes included for staggered-capable search");
  console.log("✓ C-Class W205/W206 generations isolated");
  console.log("✓ E-Class W213/W214 generations isolated");
  console.log("✓ GLC X253/X254 generations isolated");
  
  console.log("");
  console.log(result.success ? "✅ Import completed successfully!" : "❌ Import completed with errors");
  
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
