/**
 * Import BMW Fitment Data - Phase 1
 * 
 * Models: 3 Series, 5 Series, X3, X5
 * 
 * CRITICAL: BMW changed bolt pattern in 2019!
 * - Pre-2019: 5x120 (72.6mm or 74.1mm center bore)
 * - 2019+: 5x112 (66.6mm center bore)
 * 
 * GENERATION ISOLATION:
 * - 3 Series G20 (2019+) vs F30 (2012-2018)
 * - 5 Series G60 (2024+) vs G30 (2017-2023) vs F10 (2011-2016)
 * - X3 G01 (2018+) vs F25 (2011-2017)
 * - X5 G05 (2019+) vs F15 (2014-2018)
 * 
 * STAGGERED: Very common on BMW, especially M Sport and M models
 * 
 * Run: npx tsx scripts/import-bmw-phase1.ts
 */

import { importFromJson, type FitmentInput } from "../src/lib/fitment-db/fitmentManualImport";

const records: FitmentInput[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// BMW SPECS BY ERA
// ═══════════════════════════════════════════════════════════════════════════════

// NEW ERA (2019+) - 5x112
const bmwNew = {
  boltPattern: "5x112",
  centerBoreMm: 66.6,
  threadSize: "M14x1.25",
  seatType: "conical",
};

// OLD ERA (pre-2019) - 5x120, 72.6mm
const bmwOld72 = {
  boltPattern: "5x120",
  centerBoreMm: 72.6,
  threadSize: "M14x1.25",
  seatType: "conical",
};

// OLD ERA X5 F15 - 5x120, 74.1mm (different!)
const bmwOldX5 = {
  boltPattern: "5x120",
  centerBoreMm: 74.1,
  threadSize: "M14x1.25",
  seatType: "conical",
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
      const sourceNotes = t.staggered === true
        ? `${specs.sourceNotes} - STAGGERED FITMENT`
        : `${specs.sourceNotes} - SQUARE FITMENT`;
      
      records.push({
        year,
        make: "BMW",
        model,
        trim: t.trim,
        displayTrim: t.displayTrim,
        source: "generation-baseline",
        confidence: "high",
        ...specs,
        sourceNotes,
      } as FitmentInput);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 SERIES G20/G21 (2019-2025) - NEW PLATFORM, 5x112
// ═══════════════════════════════════════════════════════════════════════════════

const series3G20Trims = [
  { trim: "330i", displayTrim: "330i", staggered: false },
  { trim: "330i xDrive", displayTrim: "330i xDrive", staggered: false },
  { trim: "330e", displayTrim: "330e", staggered: false },
  { trim: "M340i", displayTrim: "M340i", staggered: true },
  { trim: "M340i xDrive", displayTrim: "M340i xDrive", staggered: true },
  { trim: "M3", displayTrim: "M3", staggered: true },
  { trim: "M3 Competition", displayTrim: "M3 Competition", staggered: true },
  { trim: "M3 Competition xDrive", displayTrim: "M3 Competition xDrive", staggered: true },
];

addYearRange("3 Series", 2019, 2025, series3G20Trims, {
  ...bmwNew,
  offsetMinMm: 27,
  offsetMaxMm: 45,
  oemTireSizes: [
    "225/45R18",      // Base front
    "255/40R18",      // Base rear / M Sport
    "225/40R19",      // 19" front
    "255/35R19",      // 19" rear
    "275/35R19",      // M3 rear
    "275/30R20",      // M3 Competition front
    "285/30R20",      // M3 Competition rear
  ],
  sourceNotes: "3 Series G20/G21 (2019+) - 5x112",
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 SERIES F30/F31 (2012-2018) - OLD PLATFORM, 5x120
// ═══════════════════════════════════════════════════════════════════════════════

const series3F30Trims = [
  { trim: "320i", displayTrim: "320i", staggered: false },
  { trim: "320i xDrive", displayTrim: "320i xDrive", staggered: false },
  { trim: "328i", displayTrim: "328i", staggered: false },
  { trim: "328i xDrive", displayTrim: "328i xDrive", staggered: false },
  { trim: "330i", displayTrim: "330i", staggered: false },
  { trim: "330i xDrive", displayTrim: "330i xDrive", staggered: false },
  { trim: "340i", displayTrim: "340i", staggered: true },
  { trim: "340i xDrive", displayTrim: "340i xDrive", staggered: true },
];

addYearRange("3 Series", 2012, 2018, series3F30Trims, {
  ...bmwOld72,
  offsetMinMm: 30,
  offsetMaxMm: 47,
  oemTireSizes: [
    "205/60R16",      // Base
    "225/50R17",      // 17" square
    "225/45R18",      // 18" front
    "255/40R18",      // 18" rear
    "225/40R19",      // 19" front
    "255/35R19",      // 19" rear
  ],
  sourceNotes: "3 Series F30/F31 (2012-2018) - 5x120",
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 SERIES G60 (2024-2025) - NEW PLATFORM
// ═══════════════════════════════════════════════════════════════════════════════

const series5G60Trims = [
  { trim: "530i", displayTrim: "530i", staggered: false },
  { trim: "530i xDrive", displayTrim: "530i xDrive", staggered: false },
  { trim: "540i xDrive", displayTrim: "540i xDrive", staggered: true },
  { trim: "i5 eDrive40", displayTrim: "i5 eDrive40", staggered: false },
  { trim: "i5 xDrive40", displayTrim: "i5 xDrive40", staggered: false },
  { trim: "i5 M60 xDrive", displayTrim: "i5 M60 xDrive", staggered: true },
  { trim: "M5", displayTrim: "M5", staggered: true },
];

addYearRange("5 Series", 2024, 2025, series5G60Trims, {
  ...bmwNew,
  offsetMinMm: 27,
  offsetMaxMm: 44,
  oemTireSizes: [
    "245/45R18",      // Base front
    "275/40R18",      // Base rear
    "245/40R19",      // 19" front
    "275/35R19",      // 19" rear
    "245/35R20",      // 20" front
    "275/30R20",      // 20" rear
    "275/35R21",      // M5 front
    "285/30R21",      // M5 rear
  ],
  sourceNotes: "5 Series G60 (2024+) - 5x112",
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 SERIES G30/G31 (2017-2023) - 5x112
// ═══════════════════════════════════════════════════════════════════════════════

const series5G30Trims = [
  { trim: "530i", displayTrim: "530i", staggered: false },
  { trim: "530i xDrive", displayTrim: "530i xDrive", staggered: false },
  { trim: "530e", displayTrim: "530e", staggered: false },
  { trim: "530e xDrive", displayTrim: "530e xDrive", staggered: false },
  { trim: "540i", displayTrim: "540i", staggered: true },
  { trim: "540i xDrive", displayTrim: "540i xDrive", staggered: true },
  { trim: "M550i xDrive", displayTrim: "M550i xDrive", staggered: true },
  { trim: "M5", displayTrim: "M5", staggered: true },
  { trim: "M5 Competition", displayTrim: "M5 Competition", staggered: true },
];

addYearRange("5 Series", 2017, 2023, series5G30Trims, {
  ...bmwNew,
  offsetMinMm: 27,
  offsetMaxMm: 44,
  oemTireSizes: [
    "225/55R17",      // Base
    "245/45R18",      // 18" front
    "275/40R18",      // 18" rear
    "245/40R19",      // 19" front
    "275/35R19",      // 19" rear
    "245/35R20",      // 20" front
    "275/30R20",      // 20" rear
    "275/35R20",      // M5 front
    "285/35R20",      // M5 rear
  ],
  sourceNotes: "5 Series G30/G31 (2017-2023) - 5x112",
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 SERIES F10/F11 (2011-2016) - OLD PLATFORM, 5x120
// ═══════════════════════════════════════════════════════════════════════════════

const series5F10Trims = [
  { trim: "528i", displayTrim: "528i", staggered: false },
  { trim: "528i xDrive", displayTrim: "528i xDrive", staggered: false },
  { trim: "535i", displayTrim: "535i", staggered: true },
  { trim: "535i xDrive", displayTrim: "535i xDrive", staggered: true },
  { trim: "550i", displayTrim: "550i", staggered: true },
  { trim: "550i xDrive", displayTrim: "550i xDrive", staggered: true },
  { trim: "M5", displayTrim: "M5", staggered: true },
];

addYearRange("5 Series", 2011, 2016, series5F10Trims, {
  ...bmwOld72,
  offsetMinMm: 30,
  offsetMaxMm: 44,
  oemTireSizes: [
    "225/55R17",      // Base
    "245/45R18",      // 18" front
    "275/40R18",      // 18" rear
    "245/40R19",      // 19" front
    "275/35R19",      // 19" rear
    "265/35R20",      // M5 front
    "295/30R20",      // M5 rear
  ],
  sourceNotes: "5 Series F10/F11 (2011-2016) - 5x120",
});

// ═══════════════════════════════════════════════════════════════════════════════
// X3 G01 (2018-2025) - 5x112
// ═══════════════════════════════════════════════════════════════════════════════

const x3G01Trims = [
  { trim: "sDrive30i", displayTrim: "sDrive30i", staggered: false },
  { trim: "xDrive30i", displayTrim: "xDrive30i", staggered: false },
  { trim: "xDrive30e", displayTrim: "xDrive30e", staggered: false },
  { trim: "M40i", displayTrim: "M40i", staggered: true },
  { trim: "X3 M", displayTrim: "X3 M", staggered: true },
  { trim: "X3 M Competition", displayTrim: "X3 M Competition", staggered: true },
];

addYearRange("X3", 2018, 2025, x3G01Trims, {
  ...bmwNew,
  offsetMinMm: 32,
  offsetMaxMm: 48,
  oemTireSizes: [
    "225/60R18",      // Base
    "245/50R19",      // 19" square
    "245/45R20",      // 20" front
    "275/40R20",      // 20" rear
    "255/40R21",      // X3 M front
    "265/35R21",      // X3 M rear
  ],
  sourceNotes: "X3 G01 (2018+) - 5x112",
});

// ═══════════════════════════════════════════════════════════════════════════════
// X3 F25 (2011-2017) - OLD PLATFORM, 5x120
// ═══════════════════════════════════════════════════════════════════════════════

const x3F25Trims = [
  { trim: "sDrive28i", displayTrim: "sDrive28i", staggered: false },
  { trim: "xDrive28i", displayTrim: "xDrive28i", staggered: false },
  { trim: "xDrive28d", displayTrim: "xDrive28d", staggered: false },
  { trim: "xDrive35i", displayTrim: "xDrive35i", staggered: true },
];

addYearRange("X3", 2011, 2017, x3F25Trims, {
  ...bmwOld72,
  offsetMinMm: 32,
  offsetMaxMm: 48,
  oemTireSizes: [
    "225/60R17",      // Base
    "245/55R18",      // 18" square
    "245/50R19",      // 19" square
    "245/45R19",      // 19" front M Sport
    "275/40R19",      // 19" rear M Sport
  ],
  sourceNotes: "X3 F25 (2011-2017) - 5x120",
});

// ═══════════════════════════════════════════════════════════════════════════════
// X5 G05 (2019-2025) - 5x112
// ═══════════════════════════════════════════════════════════════════════════════

const x5G05Trims = [
  { trim: "sDrive40i", displayTrim: "sDrive40i", staggered: false },
  { trim: "xDrive40i", displayTrim: "xDrive40i", staggered: false },
  { trim: "xDrive45e", displayTrim: "xDrive45e", staggered: false },
  { trim: "xDrive50i", displayTrim: "xDrive50i", staggered: true },
  { trim: "M50i", displayTrim: "M50i", staggered: true },
  { trim: "X5 M", displayTrim: "X5 M", staggered: true },
  { trim: "X5 M Competition", displayTrim: "X5 M Competition", staggered: true },
];

addYearRange("X5", 2019, 2025, x5G05Trims, {
  ...bmwNew,
  offsetMinMm: 32,
  offsetMaxMm: 48,
  oemTireSizes: [
    "265/50R19",      // Base
    "275/45R20",      // 20" front
    "305/40R20",      // 20" rear
    "275/40R21",      // 21" front
    "315/35R21",      // 21" rear
    "285/35R22",      // 22" front (X5 M)
    "315/30R22",      // 22" rear (X5 M)
  ],
  sourceNotes: "X5 G05 (2019+) - 5x112",
});

// ═══════════════════════════════════════════════════════════════════════════════
// X5 F15 (2014-2018) - OLD PLATFORM, 5x120, 74.1mm CENTER BORE
// ═══════════════════════════════════════════════════════════════════════════════

const x5F15Trims = [
  { trim: "sDrive35i", displayTrim: "sDrive35i", staggered: false },
  { trim: "xDrive35i", displayTrim: "xDrive35i", staggered: false },
  { trim: "xDrive35d", displayTrim: "xDrive35d", staggered: false },
  { trim: "xDrive40e", displayTrim: "xDrive40e", staggered: false },
  { trim: "xDrive50i", displayTrim: "xDrive50i", staggered: true },
  { trim: "X5 M", displayTrim: "X5 M", staggered: true },
];

addYearRange("X5", 2014, 2018, x5F15Trims, {
  ...bmwOldX5, // Note: 74.1mm center bore!
  offsetMinMm: 32,
  offsetMaxMm: 48,
  oemTireSizes: [
    "255/55R18",      // Base
    "255/50R19",      // 19" front
    "285/45R19",      // 19" rear
    "275/45R20",      // 20" front
    "315/40R20",      // 20" rear
    "285/35R21",      // X5 M front
    "325/30R21",      // X5 M rear
  ],
  sourceNotes: "X5 F15 (2014-2018) - 5x120 74.1mm CB",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORTING BMW FITMENT DATA - PHASE 1");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`Total records to import: ${records.length}`);
  console.log("");
  
  // Summary by model and generation
  const summary: Record<string, { count: number; years: Set<number>; bolt: string }> = {};
  for (const r of records) {
    const year = r.year as number;
    const model = r.model as string;
    const bolt = r.boltPattern as string;
    let genKey = `${model} (${bolt})`;
    
    if (!summary[genKey]) summary[genKey] = { count: 0, years: new Set(), bolt };
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
  console.log(`Staggered fitment: ${staggeredCount}/${records.length} (${Math.round(staggeredCount/records.length*100)}%)`);
  console.log("");
  
  // Bolt pattern breakdown
  const bolt112 = records.filter(r => r.boltPattern === "5x112").length;
  const bolt120 = records.filter(r => r.boltPattern === "5x120").length;
  console.log("BOLT PATTERN BREAKDOWN:");
  console.log(`  5x112 (2019+):   ${bolt112} records`);
  console.log(`  5x120 (pre-2019): ${bolt120} records`);
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
  console.log("CRITICAL NOTES - BOLT PATTERN CHANGE");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("⚠️  BMW changed bolt pattern around 2019!");
  console.log("   Pre-2019: 5x120 (72.6mm or 74.1mm CB)");
  console.log("   2019+:    5x112 (66.6mm CB)");
  console.log("");
  console.log("✓ 3 Series: F30 (5x120) vs G20 (5x112) isolated");
  console.log("✓ 5 Series: F10 (5x120) vs G30/G60 (5x112) isolated");
  console.log("✓ X3: F25 (5x120) vs G01 (5x112) isolated");
  console.log("✓ X5: F15 (5x120 74.1mm!) vs G05 (5x112) isolated");
  
  console.log("");
  console.log(result.success ? "✅ Import completed successfully!" : "❌ Import completed with errors");
  
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
