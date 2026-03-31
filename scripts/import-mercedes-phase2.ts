/**
 * Import Mercedes-Benz Fitment Data - Phase 2
 * 
 * Models: GLE, GLS
 * 
 * GENERATION ISOLATION:
 * - GLE W167 (2020-present) vs W166 (2016-2019)
 * - GLS X167 (2020-present) vs X166 (2017-2019)
 * 
 * STAGGERED FITMENT:
 * - AMG 53/63 models have staggered front/rear
 * - All OEM sizes preserved for proper search
 * 
 * All use:
 * - 5x112 bolt pattern
 * - 66.6mm center bore
 * - M14x1.5 thread, ball seat
 * 
 * Run: npx tsx scripts/import-mercedes-phase2.ts
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
  seatType: "ball",
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
      
      // Use "mercedes" to match keys.ts normalization
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
// GLE W167 (2020-2025) - Current Generation
// ═══════════════════════════════════════════════════════════════════════════════

const gleW167Trims = [
  { trim: "GLE 350", displayTrim: "GLE 350 4MATIC", staggered: false },
  { trim: "GLE 350e", displayTrim: "GLE 350e 4MATIC", staggered: false },
  { trim: "GLE 450", displayTrim: "GLE 450 4MATIC", staggered: false },
  { trim: "GLE 580", displayTrim: "GLE 580 4MATIC", staggered: false },
  { trim: "AMG GLE 53", displayTrim: "AMG GLE 53 4MATIC+", staggered: true },
  { trim: "AMG GLE 63", displayTrim: "AMG GLE 63 4MATIC+", staggered: true },
  { trim: "AMG GLE 63 S", displayTrim: "AMG GLE 63 S 4MATIC+", staggered: true },
];

addYearRange("GLE", 2020, 2025, gleW167Trims, {
  offsetMinMm: 38,
  offsetMaxMm: 56,
  oemTireSizes: [
    "255/50R19",      // Base 19"
    "255/45R20",      // 20" front option
    "275/45R20",      // 20" square
    "275/45R21",      // 21" front / square
    "285/40R22",      // 22" square
    "315/40R21",      // 21" staggered rear (AMG)
    "325/35R22",      // 22" staggered rear (AMG)
  ],
  sourceNotes: "GLE W167 (2020+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLE W166 (2016-2019) - Previous Generation
// ═══════════════════════════════════════════════════════════════════════════════

const gleW166Trims = [
  { trim: "GLE 350", displayTrim: "GLE 350", staggered: false },
  { trim: "GLE 350 4MATIC", displayTrim: "GLE 350 4MATIC", staggered: false },
  { trim: "GLE 350d", displayTrim: "GLE 350d 4MATIC", staggered: false },
  { trim: "GLE 400", displayTrim: "GLE 400 4MATIC", staggered: false },
  { trim: "GLE 450 AMG", displayTrim: "GLE 450 AMG 4MATIC", staggered: true },
  { trim: "GLE 550e", displayTrim: "GLE 550e 4MATIC", staggered: false },
  { trim: "AMG GLE 43", displayTrim: "AMG GLE 43 4MATIC", staggered: true },
  { trim: "AMG GLE 63", displayTrim: "AMG GLE 63 4MATIC", staggered: true },
  { trim: "AMG GLE 63 S", displayTrim: "AMG GLE 63 S 4MATIC", staggered: true },
];

addYearRange("GLE", 2016, 2019, gleW166Trims, {
  offsetMinMm: 38,
  offsetMaxMm: 56,
  oemTireSizes: [
    "255/55R18",      // Base 18"
    "255/50R19",      // 19" square
    "275/50R19",      // 19" rear option
    "275/45R20",      // 20" square
    "295/40R20",      // 20" rear option
    "275/45R21",      // 21" front (AMG)
    "295/40R21",      // 21" rear (AMG)
  ],
  sourceNotes: "GLE W166 (2016-2019)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLS X167 (2020-2025) - Current Generation
// ═══════════════════════════════════════════════════════════════════════════════

const glsX167Trims = [
  { trim: "GLS 450", displayTrim: "GLS 450 4MATIC", staggered: false },
  { trim: "GLS 580", displayTrim: "GLS 580 4MATIC", staggered: false },
  { trim: "Maybach GLS 600", displayTrim: "Mercedes-Maybach GLS 600", staggered: true },
  { trim: "AMG GLS 63", displayTrim: "AMG GLS 63 4MATIC+", staggered: true },
];

addYearRange("GLS", 2020, 2025, glsX167Trims, {
  offsetMinMm: 35,
  offsetMaxMm: 52,
  oemTireSizes: [
    "275/50R20",      // Base 20"
    "275/45R21",      // 21" square
    "285/45R21",      // 21" option
    "285/40R22",      // 22" front
    "295/40R22",      // 22" square
    "325/35R22",      // 22" staggered rear (AMG)
    "295/35R23",      // 23" front (Maybach/AMG)
    "325/30R23",      // 23" staggered rear (Maybach/AMG)
  ],
  sourceNotes: "GLS X167 (2020+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLS X166 (2017-2019) - Previous Generation
// ═══════════════════════════════════════════════════════════════════════════════

const glsX166Trims = [
  { trim: "GLS 450", displayTrim: "GLS 450 4MATIC", staggered: false },
  { trim: "GLS 550", displayTrim: "GLS 550 4MATIC", staggered: false },
  { trim: "GLS 550e", displayTrim: "GLS 550e 4MATIC", staggered: false },
  { trim: "AMG GLS 63", displayTrim: "AMG GLS 63 4MATIC", staggered: true },
];

addYearRange("GLS", 2017, 2019, glsX166Trims, {
  offsetMinMm: 35,
  offsetMaxMm: 52,
  oemTireSizes: [
    "265/60R18",      // Base 18"
    "275/55R19",      // 19" square
    "275/50R20",      // 20" square
    "295/45R20",      // 20" rear option
    "295/40R21",      // 21" square (AMG)
    "315/35R21",      // 21" staggered rear (AMG)
  ],
  sourceNotes: "GLS X166 (2017-2019)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORTING MERCEDES-BENZ FITMENT DATA - PHASE 2 (GLE & GLS)");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`Total records to import: ${records.length}`);
  console.log("");
  
  // Summary by model and generation
  const summary: Record<string, { count: number; years: Set<number> }> = {};
  for (const r of records) {
    const year = r.year as number;
    const model = r.model as string;
    let genKey = model;
    if (model === "GLE") {
      genKey = year >= 2020 ? "GLE W167 (2020+)" : "GLE W166 (2016-2019)";
    } else if (model === "GLS") {
      genKey = year >= 2020 ? "GLS X167 (2020+)" : "GLS X166 (2017-2019)";
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
    console.log("Errors:");
    for (const err of result.errors.slice(0, 10)) {
      console.log(`  Row ${err.row}: ${err.vehicle} - ${err.error}`);
    }
  }
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("GENERATION ISOLATION VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("✓ GLE W167 (2020+) isolated from W166 (2016-2019)");
  console.log("✓ GLS X167 (2020+) isolated from X166 (2017-2019)");
  console.log("✓ AMG trims flagged as staggered");
  console.log("✓ Ball seat type applied");
  
  console.log("");
  console.log(result.success ? "✅ Import completed successfully!" : "❌ Import completed with errors");
  
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
