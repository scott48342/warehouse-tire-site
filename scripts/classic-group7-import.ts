/**
 * Classic Fitment Group 7 Import
 * Platform: GM F-Body 1st Generation
 * Vehicles: Chevrolet Camaro, Pontiac Firebird
 * Years: 1967-1969
 * 
 * NOTES:
 * - First generation F-Body "pony cars"
 * - Stock wheels: 14" (base) or 15" (performance packages)
 * - 5x4.75" (5x120.65) bolt pattern - GM standard
 * - Restomod range: 15" to 20" common
 * 
 * RULES:
 * - All data goes to classic_fitments table ONLY
 * - No modifications to vehicle_fitments
 * - Surgical rollback via batch_tag
 * 
 * Run: npx tsx scripts/classic-group7-import.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { importClassicBatch } from "../src/lib/classic-fitment/classicImport";
import { db } from "../src/lib/fitment-db/db";
import { classicFitments } from "../src/lib/classic-fitment/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import type { ClassicFitmentInput } from "../src/lib/classic-fitment/types";

// ============================================================================
// Group 7 Platform Definition - 1st Gen F-Body
// ============================================================================

const GROUP_7_PLATFORM = {
  platformCode: "gm-f-body-1",
  platformName: "GM F-Body 1st Generation",
  generationName: "1967-1969 Original Pony Car",
  
  // Year coverage (full 1st gen production run)
  yearStart: 1967,
  yearEnd: 1969,
  
  // Baseline specs - same as 2nd gen and A-body
  commonBoltPattern: "5x120.65",  // 5x4.75" - GM standard
  commonCenterBore: 70.3,         // GM hub bore
  commonThreadSize: "7/16-20",    // GM standard for this era
  commonSeatType: "conical",      // Conical/tapered (60°)
  
  // Recommended wheel ranges
  // Stock: 14x5.5-7" (base) or 15x6-7" (Z/28, SS396)
  // Restomod: 15" to 20" is very common for this generation
  recWheelDiameterMin: 15,        // Minimum for good tire selection
  recWheelDiameterMax: 20,        // Max for restomod without major mods
  recWheelWidthMin: 7.0,
  recWheelWidthMax: 10.0,         // Wide wheels need fender mods
  recOffsetMinMm: -6,             // Near zero typical for classic look
  recOffsetMaxMm: 25,             // Some positive okay
  
  // Stock reference (varies by trim)
  stockWheelDiameter: 14,         // Base models
  stockWheelWidth: 6,
  stockTireSize: "E70-14 / F70-14 / F60-15", // Period tire codes
  
  // Confidence & verification
  confidence: "high" as const,
  verificationNote: "GM F-Body 1st gen platform 1967-1969. Original muscle car era. Z/28 and SS packages had larger brakes and may have different clearance requirements. Same bolt pattern as 2nd gen F-Body and all GM A/F/G-Body.",
  fitmentStyle: "stock_baseline",
  
  // Modification context
  commonModifications: [
    "4-wheel disc brake conversion",
    "Mini-tub for wider tires",
    "Coilover suspension",
    "LS swap (modern engine)",
    "Subframe connectors",
  ],
  modificationRisk: "low" as const, // Very well-documented platform
};

// ============================================================================
// Group 7 Vehicle Records
// ============================================================================

const GROUP_7_RECORDS: ClassicFitmentInput[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Chevrolet Camaro - 1967-1969
  // The original F-Body pony car
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_7_PLATFORM,
    make: "Chevrolet",
    model: "Camaro",
    notes: "1st gen Camaro. Z/28 was the road racing package (302ci). SS396 was the big block option. RS was appearance package (hidden headlights). Rally Sport combined RS with Z/28 or SS. 1969 Z/28 and SS had special hoods.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Pontiac Firebird - 1967-1969
  // Pontiac's F-Body variant
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_7_PLATFORM,
    make: "Pontiac",
    model: "Firebird",
    notes: "1st gen Firebird. Shared platform with Camaro but with Pontiac engines and styling. 400 was the big performance engine. Sprint package was the inline-6 performance option. Ram Air models are most valuable.",
  },
];

// ============================================================================
// Import Runner
// ============================================================================

async function importGroup7() {
  const BATCH_TAG = "classic-gm-f-body-1-v1";
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Classic Fitment Import - Group 7: GM F-Body 1st Gen (1967-1969)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Platform: ${GROUP_7_PLATFORM.platformCode}`);
  console.log(`Years: ${GROUP_7_PLATFORM.yearStart}-${GROUP_7_PLATFORM.yearEnd}`);
  console.log(`Batch Tag: ${BATCH_TAG}`);
  console.log(`Records to import: ${GROUP_7_RECORDS.length}`);
  console.log("");
  console.log("Target wheel search range:");
  console.log(`  Diameter: ${GROUP_7_PLATFORM.recWheelDiameterMin}" - ${GROUP_7_PLATFORM.recWheelDiameterMax}"`);
  console.log(`  Width: ${GROUP_7_PLATFORM.recWheelWidthMin}" - ${GROUP_7_PLATFORM.recWheelWidthMax}"`);
  console.log(`  Offset: ${GROUP_7_PLATFORM.recOffsetMinMm}mm - ${GROUP_7_PLATFORM.recOffsetMaxMm}mm`);
  console.log("");
  
  // Pre-check: verify no conflicts
  console.log("[1] Checking for existing records...");
  
  for (const record of GROUP_7_RECORDS) {
    const normalizedMake = record.make.toLowerCase();
    const normalizedModel = record.model.toLowerCase().replace(/\s+/g, "-");
    
    const existing = await db
      .select()
      .from(classicFitments)
      .where(
        and(
          eq(classicFitments.make, normalizedMake),
          eq(classicFitments.model, normalizedModel),
          eq(classicFitments.isActive, true)
        )
      );
    
    if (existing.length > 0) {
      // Check if any overlap with our year range
      const overlapping = existing.filter(
        e => e.yearStart <= GROUP_7_PLATFORM.yearEnd && e.yearEnd >= GROUP_7_PLATFORM.yearStart
      );
      if (overlapping.length > 0) {
        console.log(`  ⚠️  Overlapping: ${record.make} ${record.model} (${overlapping.length} records) - will update`);
      } else {
        console.log(`  ✓  No overlap: ${record.make} ${record.model}`);
      }
    } else {
      console.log(`  ✓  New: ${record.make} ${record.model}`);
    }
  }
  
  // Run import
  console.log("");
  console.log("[2] Running import...");
  
  const result = await importClassicBatch(GROUP_7_RECORDS, BATCH_TAG);
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Import Results");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Total:   ${result.totalRecords}`);
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors:  ${result.errors.length}`);
  
  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    result.errors.forEach(e => console.log(`  ❌ ${e}`));
  }
  
  // Validation queries
  console.log("");
  console.log("[3] Validating inserted records...");
  
  const inserted = await db
    .select()
    .from(classicFitments)
    .where(eq(classicFitments.batchTag, BATCH_TAG));
  
  console.log(`  ✓ Found ${inserted.length} records with batch tag '${BATCH_TAG}'`);
  
  for (const rec of inserted) {
    console.log(`    - ${rec.make} ${rec.model} (${rec.yearStart}-${rec.yearEnd}): ${rec.commonBoltPattern}`);
    console.log(`      Diameter range: ${rec.recWheelDiameterMin}"-${rec.recWheelDiameterMax}"`);
  }
  
  // Test API-style lookup
  console.log("");
  console.log("[4] Testing lookups...");
  
  const testCases = [
    { year: 1967, make: "chevrolet", model: "camaro" },
    { year: 1968, make: "chevrolet", model: "camaro" },
    { year: 1969, make: "chevrolet", model: "camaro" },
    { year: 1967, make: "pontiac", model: "firebird" },
    { year: 1969, make: "pontiac", model: "firebird" },
  ];
  
  const { getClassicFitment } = await import("../src/lib/classic-fitment/classicLookup");
  
  for (const tc of testCases) {
    const result = await getClassicFitment(tc.year, tc.make, tc.model);
    if (result.isClassicVehicle && result.fitmentMode === "classic") {
      console.log(`  ✓ ${tc.year} ${tc.make} ${tc.model}:`);
      console.log(`    Platform: ${result.platform.code}`);
      console.log(`    Diameter: ${result.recommendedRange.diameter.min}"-${result.recommendedRange.diameter.max}"`);
    } else {
      console.log(`  ❌ ${tc.year} ${tc.make} ${tc.model}: Not found`);
    }
  }
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("✅ Import complete!");
  console.log("");
  console.log("Selectable diameters for 1969 Camaro should now be: 15, 16, 17, 18, 19, 20");
  console.log("═══════════════════════════════════════════════════════════════");
}

importGroup7()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
