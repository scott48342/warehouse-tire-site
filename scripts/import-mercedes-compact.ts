/**
 * Import Mercedes-Benz Compact Models - A-Class & CLA
 * 
 * IMPORTANT: Most compact Mercedes are SQUARE fitment (same F/R)
 * Only AMG 45 models have true staggered setups
 * 
 * GENERATION ISOLATION:
 * - A-Class W177 (2019-present) - US market only
 * - CLA C118 (2020-present) - Current gen
 * - CLA C117 (2014-2019) - Previous gen
 * 
 * STAGGERED DETECTION:
 * - AMG 35: Square (same F/R)
 * - AMG 45: Staggered (different F/R widths)
 * - All base/non-AMG: Square
 * 
 * Run: npx tsx scripts/import-mercedes-compact.ts
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
      // Only mark as staggered if explicitly true
      const sourceNotes = t.staggered === true
        ? `${specs.sourceNotes} - STAGGERED FITMENT (AMG 45)`
        : `${specs.sourceNotes} - SQUARE FITMENT`;
      
      records.push({
        year,
        make: "mercedes", // Use normalized name
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
// A-CLASS W177 (2019-2025) - US Market
// ═══════════════════════════════════════════════════════════════════════════════
// Note: A-Class came to US in 2019 as W177
// All US trims are SQUARE fitment (no AMG 45 sold in US)

const aClassW177Trims = [
  { trim: "A 220", displayTrim: "A 220", staggered: false },
  { trim: "A 220 4MATIC", displayTrim: "A 220 4MATIC", staggered: false },
  { trim: "AMG A 35", displayTrim: "AMG A 35 4MATIC", staggered: false }, // Square!
];

addYearRange("A-Class", 2019, 2025, aClassW177Trims, {
  offsetMinMm: 45,
  offsetMaxMm: 52,
  // All square sizes - no staggered rear
  oemTireSizes: [
    "205/60R16",      // Base 16"
    "225/45R17",      // 17" square
    "225/40R18",      // 18" square
    "235/35R19",      // 19" square (AMG A 35)
  ],
  sourceNotes: "A-Class W177 (2019+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLA C118 (2020-2025) - Current Generation
// ═══════════════════════════════════════════════════════════════════════════════
// AMG CLA 35: Square
// AMG CLA 45: Staggered (235/35R19 F / 255/30R19 R)

const claC118Trims = [
  { trim: "CLA 250", displayTrim: "CLA 250", staggered: false },
  { trim: "CLA 250 4MATIC", displayTrim: "CLA 250 4MATIC", staggered: false },
  { trim: "AMG CLA 35", displayTrim: "AMG CLA 35 4MATIC", staggered: false }, // Square!
  { trim: "AMG CLA 45", displayTrim: "AMG CLA 45 4MATIC+", staggered: true }, // Staggered!
];

addYearRange("CLA", 2020, 2025, claC118Trims, {
  offsetMinMm: 45,
  offsetMaxMm: 52,
  oemTireSizes: [
    "225/45R17",      // Base 17" square
    "225/40R18",      // 18" square
    "235/40R18",      // 18" sport square
    "235/35R19",      // 19" front (AMG)
    "255/30R19",      // 19" rear (AMG CLA 45 only - staggered)
  ],
  sourceNotes: "CLA C118 (2020+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLA C117 (2014-2019) - Previous Generation
// ═══════════════════════════════════════════════════════════════════════════════

const claC117Trims = [
  { trim: "CLA 250", displayTrim: "CLA 250", staggered: false },
  { trim: "CLA 250 4MATIC", displayTrim: "CLA 250 4MATIC", staggered: false },
  { trim: "AMG CLA 45", displayTrim: "AMG CLA 45 4MATIC", staggered: true }, // Staggered!
];

addYearRange("CLA", 2014, 2019, claC117Trims, {
  offsetMinMm: 45,
  offsetMaxMm: 52,
  oemTireSizes: [
    "205/55R16",      // Base 16" square
    "225/45R17",      // 17" square
    "225/40R18",      // 18" square
    "235/35R19",      // 19" front (AMG)
    "255/30R19",      // 19" rear (AMG CLA 45 only - staggered)
  ],
  sourceNotes: "CLA C117 (2014-2019)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORTING MERCEDES-BENZ COMPACT MODELS (A-Class & CLA)");
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
    if (model === "A-Class") {
      genKey = "A-Class W177 (2019+)";
    } else if (model === "CLA") {
      genKey = year >= 2020 ? "CLA C118 (2020+)" : "CLA C117 (2014-2019)";
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
  
  // Count staggered vs square
  const staggeredCount = records.filter(r => 
    (r.sourceNotes as string)?.includes("STAGGERED")
  ).length;
  const squareCount = records.filter(r => 
    (r.sourceNotes as string)?.includes("SQUARE")
  ).length;
  
  console.log("FITMENT TYPE BREAKDOWN:");
  console.log(`  Square (same F/R):    ${squareCount}/${records.length} (${Math.round(squareCount/records.length*100)}%)`);
  console.log(`  Staggered (diff F/R): ${staggeredCount}/${records.length} (${Math.round(staggeredCount/records.length*100)}%)`);
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
  console.log("STAGGERED DETECTION NOTES");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("✓ A-Class: ALL SQUARE (no AMG 45 in US market)");
  console.log("✓ CLA base/AMG 35: SQUARE");
  console.log("✓ CLA AMG 45 ONLY: STAGGERED (235/35R19 F / 255/30R19 R)");
  console.log("✓ Ball seat type applied");
  
  console.log("");
  console.log(result.success ? "✅ Import completed successfully!" : "❌ Import completed with errors");
  
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
