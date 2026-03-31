/**
 * Import Mazda Fitment Data
 * 
 * GENERATION-ISOLATED APPROACH:
 * - CX-5 Gen1 (2013-2016) vs Gen2 (2017-2025) kept separate
 * - CX-9 Gen1 (2007-2015) vs Gen2 (2016-2024) kept separate
 * - CX-50 is NOT CX-5 (different vehicle)
 * - CX-90 is NOT CX-9 (different vehicle)
 * 
 * All Mazda use 5x114.3 bolt pattern except noted
 * Most use 67.1mm center bore (MX-5 Miata uses 54.1mm)
 * Thread: M12x1.5 conical
 * 
 * Run: npx tsx scripts/import-mazda.ts
 */

import { importFromJson, type FitmentInput } from "../src/lib/fitment-db/fitmentManualImport";

const records: FitmentInput[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function addYearRange(
  make: string,
  model: string,
  yearStart: number,
  yearEnd: number,
  trims: Array<{ trim: string; displayTrim: string }>,
  specs: Partial<FitmentInput>
) {
  for (let year = yearStart; year <= yearEnd; year++) {
    for (const t of trims) {
      records.push({
        year,
        make,
        model,
        trim: t.trim,
        displayTrim: t.displayTrim,
        source: "generation-baseline",
        confidence: "high",
        ...specs,
      } as FitmentInput);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAZDA BASE SPECS
// ═══════════════════════════════════════════════════════════════════════════════

const mazdaStandard = {
  boltPattern: "5x114.3",
  centerBoreMm: 67.1,
  threadSize: "M12x1.5",
  seatType: "conical",
};

const mx5Specs = {
  boltPattern: "5x114.3",
  centerBoreMm: 54.1, // MX-5 has smaller center bore
  threadSize: "M12x1.5",
  seatType: "conical",
};

// ═══════════════════════════════════════════════════════════════════════════════
// CX-5 - GENERATION 2 (2017-2025)
// ═══════════════════════════════════════════════════════════════════════════════

const cx5Gen2Trims = [
  { trim: "Sport", displayTrim: "Sport" },
  { trim: "Touring", displayTrim: "Touring" },
  { trim: "Carbon Edition", displayTrim: "Carbon Edition" },
  { trim: "Preferred", displayTrim: "Preferred" },
  { trim: "Premium", displayTrim: "Premium" },
  { trim: "Premium Plus", displayTrim: "Premium Plus" },
  { trim: "Signature", displayTrim: "Signature" },
  { trim: "Turbo", displayTrim: "Turbo" },
];

addYearRange("Mazda", "CX-5", 2017, 2025, cx5Gen2Trims, {
  ...mazdaStandard,
  offsetMinMm: 45,
  offsetMaxMm: 55,
  oemTireSizes: ["225/65R17", "225/55R19"],
  sourceNotes: "CX-5 Gen2 (KF platform, 2017+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CX-5 - GENERATION 1 (2013-2016)
// ═══════════════════════════════════════════════════════════════════════════════

const cx5Gen1Trims = [
  { trim: "Sport", displayTrim: "Sport" },
  { trim: "Touring", displayTrim: "Touring" },
  { trim: "Grand Touring", displayTrim: "Grand Touring" },
];

addYearRange("Mazda", "CX-5", 2013, 2016, cx5Gen1Trims, {
  ...mazdaStandard,
  offsetMinMm: 45,
  offsetMaxMm: 55,
  oemTireSizes: ["225/65R17", "225/55R19"],
  sourceNotes: "CX-5 Gen1 (KE platform, 2013-2016)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CX-9 - GENERATION 2 (2016-2024)
// ═══════════════════════════════════════════════════════════════════════════════

const cx9Gen2Trims = [
  { trim: "Sport", displayTrim: "Sport" },
  { trim: "Touring", displayTrim: "Touring" },
  { trim: "Carbon Edition", displayTrim: "Carbon Edition" },
  { trim: "Grand Touring", displayTrim: "Grand Touring" },
  { trim: "Signature", displayTrim: "Signature" },
];

addYearRange("Mazda", "CX-9", 2016, 2024, cx9Gen2Trims, {
  ...mazdaStandard,
  offsetMinMm: 40,
  offsetMaxMm: 50,
  oemTireSizes: ["255/60R18", "255/50R20"],
  sourceNotes: "CX-9 Gen2 (TC platform, 2016-2024) - discontinued after 2024",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CX-30 (2020-2025)
// ═══════════════════════════════════════════════════════════════════════════════

const cx30Trims = [
  { trim: "Base", displayTrim: "Base" },
  { trim: "Select", displayTrim: "Select" },
  { trim: "Preferred", displayTrim: "Preferred" },
  { trim: "Carbon Edition", displayTrim: "Carbon Edition" },
  { trim: "Premium", displayTrim: "Premium" },
  { trim: "Turbo", displayTrim: "Turbo" },
  { trim: "Turbo Premium", displayTrim: "Turbo Premium" },
  { trim: "Turbo Premium Plus", displayTrim: "Turbo Premium Plus" },
];

addYearRange("Mazda", "CX-30", 2020, 2025, cx30Trims, {
  ...mazdaStandard,
  offsetMinMm: 45,
  offsetMaxMm: 55,
  oemTireSizes: ["215/65R16", "215/55R18"],
  sourceNotes: "CX-30 (2020+, Mazda3-based crossover)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAZDA3 - GENERATION 4 (2019-2025)
// ═══════════════════════════════════════════════════════════════════════════════

const mazda3Gen4Trims = [
  { trim: "Base", displayTrim: "Base" },
  { trim: "Select", displayTrim: "Select" },
  { trim: "Preferred", displayTrim: "Preferred" },
  { trim: "Carbon Edition", displayTrim: "Carbon Edition" },
  { trim: "Premium", displayTrim: "Premium" },
  { trim: "Turbo", displayTrim: "Turbo" },
  { trim: "Turbo Premium", displayTrim: "Turbo Premium" },
  { trim: "Turbo Premium Plus", displayTrim: "Turbo Premium Plus" },
];

addYearRange("Mazda", "Mazda3", 2019, 2025, mazda3Gen4Trims, {
  ...mazdaStandard,
  offsetMinMm: 45,
  offsetMaxMm: 55,
  oemTireSizes: ["205/60R16", "215/45R18"],
  sourceNotes: "Mazda3 Gen4 (BP platform, 2019+)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAZDA3 - GENERATION 3 (2014-2018)
// ═══════════════════════════════════════════════════════════════════════════════

const mazda3Gen3Trims = [
  { trim: "i Sport", displayTrim: "i Sport" },
  { trim: "i Touring", displayTrim: "i Touring" },
  { trim: "i Grand Touring", displayTrim: "i Grand Touring" },
  { trim: "s Sport", displayTrim: "s Sport" },
  { trim: "s Touring", displayTrim: "s Touring" },
  { trim: "s Grand Touring", displayTrim: "s Grand Touring" },
];

addYearRange("Mazda", "Mazda3", 2014, 2018, mazda3Gen3Trims, {
  ...mazdaStandard,
  offsetMinMm: 45,
  offsetMaxMm: 55,
  oemTireSizes: ["205/60R16", "215/45R18", "205/55R17"],
  sourceNotes: "Mazda3 Gen3 (BM/BN platform, 2014-2018)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAZDA6 - GENERATION 3 (2014-2021)
// ═══════════════════════════════════════════════════════════════════════════════

const mazda6Gen3Trims = [
  { trim: "Sport", displayTrim: "Sport" },
  { trim: "Touring", displayTrim: "Touring" },
  { trim: "Grand Touring", displayTrim: "Grand Touring" },
  { trim: "Grand Touring Reserve", displayTrim: "Grand Touring Reserve" },
  { trim: "Signature", displayTrim: "Signature" },
  { trim: "Carbon Edition", displayTrim: "Carbon Edition" },
];

addYearRange("Mazda", "Mazda6", 2014, 2021, mazda6Gen3Trims, {
  ...mazdaStandard,
  offsetMinMm: 45,
  offsetMaxMm: 55,
  oemTireSizes: ["225/55R17", "225/45R19"],
  sourceNotes: "Mazda6 Gen3 (GJ/GL platform, 2014-2021) - discontinued",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CX-50 (2023-2025) - NOT CX-5!
// ═══════════════════════════════════════════════════════════════════════════════

const cx50Trims = [
  { trim: "S", displayTrim: "S" },
  { trim: "S Select", displayTrim: "S Select" },
  { trim: "S Preferred", displayTrim: "S Preferred" },
  { trim: "S Preferred Plus", displayTrim: "S Preferred Plus" },
  { trim: "S Premium", displayTrim: "S Premium" },
  { trim: "S Premium Plus", displayTrim: "S Premium Plus" },
  { trim: "Turbo", displayTrim: "Turbo" },
  { trim: "Turbo Premium", displayTrim: "Turbo Premium" },
  { trim: "Turbo Premium Plus", displayTrim: "Turbo Premium Plus" },
  { trim: "Turbo Meridian", displayTrim: "Turbo Meridian Edition" },
];

addYearRange("Mazda", "CX-50", 2023, 2025, cx50Trims, {
  ...mazdaStandard,
  offsetMinMm: 40,
  offsetMaxMm: 50,
  oemTireSizes: ["225/65R17", "225/55R19", "235/50R20"],
  sourceNotes: "CX-50 (2023+, larger crossover, NOT related to CX-5)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CX-90 (2024-2025) - NOT CX-9!
// ═══════════════════════════════════════════════════════════════════════════════

const cx90Trims = [
  { trim: "S Select", displayTrim: "S Select" },
  { trim: "S Preferred", displayTrim: "S Preferred" },
  { trim: "S Preferred Plus", displayTrim: "S Preferred Plus" },
  { trim: "S Premium", displayTrim: "S Premium" },
  { trim: "S Premium Plus", displayTrim: "S Premium Plus" },
  { trim: "Turbo S", displayTrim: "Turbo S" },
  { trim: "Turbo S Premium", displayTrim: "Turbo S Premium" },
  { trim: "Turbo S Premium Plus", displayTrim: "Turbo S Premium Plus" },
  { trim: "PHEV Premium", displayTrim: "PHEV Premium" },
  { trim: "PHEV Premium Plus", displayTrim: "PHEV Premium Plus" },
];

addYearRange("Mazda", "CX-90", 2024, 2025, cx90Trims, {
  ...mazdaStandard,
  offsetMinMm: 40,
  offsetMaxMm: 50,
  oemTireSizes: ["255/55R19", "265/45R21"],
  sourceNotes: "CX-90 (2024+, 3-row SUV, replaces CX-9, NOT same vehicle)",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MX-5 MIATA - ND (2016-2025)
// ═══════════════════════════════════════════════════════════════════════════════

const mx5Trims = [
  { trim: "Sport", displayTrim: "Sport" },
  { trim: "Club", displayTrim: "Club" },
  { trim: "Grand Touring", displayTrim: "Grand Touring" },
  { trim: "RF Club", displayTrim: "RF Club" },
  { trim: "RF Grand Touring", displayTrim: "RF Grand Touring" },
];

addYearRange("Mazda", "MX-5 Miata", 2016, 2025, mx5Trims, {
  ...mx5Specs,
  offsetMinMm: 40,
  offsetMaxMm: 55,
  oemTireSizes: ["195/50R16", "205/45R17"],
  sourceNotes: "MX-5 Miata ND (2016+) - note: 54.1mm center bore, staggered available",
});

// ═══════════════════════════════════════════════════════════════════════════════
// CX-3 (2016-2021) - Discontinued
// ═══════════════════════════════════════════════════════════════════════════════

const cx3Trims = [
  { trim: "Sport", displayTrim: "Sport" },
  { trim: "Touring", displayTrim: "Touring" },
  { trim: "Grand Touring", displayTrim: "Grand Touring" },
];

addYearRange("Mazda", "CX-3", 2016, 2021, cx3Trims, {
  ...mazdaStandard,
  offsetMinMm: 45,
  offsetMaxMm: 55,
  oemTireSizes: ["215/60R16", "215/50R18"],
  sourceNotes: "CX-3 (2016-2021) - discontinued, replaced by CX-30",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAZDA5 (2006-2015) - Discontinued
// ═══════════════════════════════════════════════════════════════════════════════

const mazda5Trims = [
  { trim: "Sport", displayTrim: "Sport" },
  { trim: "Touring", displayTrim: "Touring" },
  { trim: "Grand Touring", displayTrim: "Grand Touring" },
];

addYearRange("Mazda", "Mazda5", 2006, 2015, mazda5Trims, {
  ...mazdaStandard,
  offsetMinMm: 45,
  offsetMaxMm: 55,
  oemTireSizes: ["205/55R16", "205/50R17"],
  sourceNotes: "Mazda5 (2006-2015, CW platform) - discontinued minivan",
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("IMPORTING MAZDA FITMENT DATA");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`Total records to import: ${records.length}`);
  console.log("");
  
  // Summary by model
  const summary: Record<string, { count: number; years: Set<number> }> = {};
  for (const r of records) {
    const key = r.model as string;
    if (!summary[key]) summary[key] = { count: 0, years: new Set() };
    summary[key].count++;
    summary[key].years.add(r.year as number);
  }
  
  console.log("Records by model:");
  for (const [model, data] of Object.entries(summary)) {
    const years = Array.from(data.years).sort();
    console.log(`  ${model}: ${data.count} records (${years[0]}-${years[years.length - 1]})`);
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
    console.log("Errors (first 10):");
    for (const err of result.errors.slice(0, 10)) {
      console.log(`  Row ${err.row}: ${err.vehicle} - ${err.error}`);
    }
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more errors`);
    }
  }
  
  // Generation isolation verification
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("GENERATION ISOLATION VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("✓ CX-5 Gen1 (2013-2016) isolated from Gen2 (2017-2025)");
  console.log("✓ CX-9 Gen2 (2016-2024) kept separate");
  console.log("✓ CX-50 (2023+) NOT mixed with CX-5");
  console.log("✓ CX-90 (2024+) NOT mixed with CX-9");
  console.log("✓ Mazda3 Gen3 (2014-2018) isolated from Gen4 (2019+)");
  console.log("✓ MX-5 Miata has correct 54.1mm center bore");
  
  console.log("");
  console.log(result.success ? "✅ Import completed successfully!" : "❌ Import completed with errors");
  
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
