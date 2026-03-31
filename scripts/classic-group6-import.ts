/**
 * Classic Fitment Group 6 Import
 * Platform: GM F-Body 2nd Generation
 * Vehicles: Chevrolet Camaro, Pontiac Firebird, Pontiac Trans Am
 * Years: 1970-1981
 * 
 * NOTES:
 * - Longest F-Body generation (12 years)
 * - Trans Am is technically a Firebird trim but iconic enough for separate entry
 * - Stock wheel sizes grew over the years (14" early → 15" late)
 * - Same bolt pattern as 1st gen F-Body and A-Body
 * 
 * RULES:
 * - All data goes to classic_fitments table ONLY
 * - No modifications to vehicle_fitments
 * - Surgical rollback via batch_tag
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
// Group 6 Platform Definition
// ============================================================================

const GROUP_6_PLATFORM = {
  platformCode: "gm-f-body-2",
  platformName: "GM F-Body 2nd Generation",
  generationName: "1970-1981 Pony Car Era",
  
  // Year coverage (full 2nd gen production run)
  yearStart: 1970,
  yearEnd: 1981,
  
  // Baseline specs (same as 1st gen F-Body)
  commonBoltPattern: "5x120.65",  // 5x4.75" - GM standard
  commonCenterBore: 70.3,         // GM hub bore
  commonThreadSize: "7/16-20",    // GM standard
  commonSeatType: "conical",      // Conical/tapered (60°)
  
  // Recommended wheel ranges
  // Stock evolved: 14x7 early → 15x7/15x8 late (Trans Am)
  // Customer-facing: 15-20" for full restomod selection
  recWheelDiameterMin: 15,
  recWheelDiameterMax: 20,        // Modern restomod max
  recWheelWidthMin: 6.0,
  recWheelWidthMax: 9.0,          // Trans Am came with 8" from factory
  recOffsetMinMm: -6,             // Near zero typical
  recOffsetMaxMm: 12,             // Some positive okay
  
  // Stock reference (varies by year/trim)
  stockWheelDiameter: 15,         // Most common across the run
  stockWheelWidth: 7,
  stockTireSize: "F60-15 / 225/70R15 / 245/60R15", // Period variations
  
  // Confidence & verification
  confidence: "high" as const,
  verificationNote: "GM F-Body 2nd gen platform 1970-1981. Same bolt pattern as 1st gen. Trans Am models often had wider wheels (15x8) from factory. 1970-1974 had 14\" base wheels; 1977+ mostly 15\".",
  fitmentStyle: "stock_baseline",
  
  // Modification context
  commonModifications: [
    "Disc brake upgrade (4-wheel)",
    "Subframe connectors",
    "Restomod wheel upgrade (15-17\")",
    "LS swap (modern engine)"
  ],
  modificationRisk: "low" as const, // Very well-documented platform
};

// ============================================================================
// Group 6 Vehicle Records
// ============================================================================

const GROUP_6_RECORDS: ClassicFitmentInput[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Chevrolet Camaro - 1970-1981
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_6_PLATFORM,
    make: "Chevrolet",
    model: "Camaro",
    notes: "2nd gen Camaro. Z28 was performance package (returned 1977). RS was appearance package. 1970-1973 had split bumper design. 1974+ had wraparound rear window. IROC-Z came later (3rd gen).",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Pontiac Firebird - 1970-1981
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_6_PLATFORM,
    make: "Pontiac",
    model: "Firebird",
    notes: "2nd gen Firebird. Base, Esprit, and Formula trims available. Shared platform with Camaro. 1977+ had revised front end. Formula had functional hood scoops.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Pontiac Trans Am - 1970-1981
  // Trans Am is technically a Firebird trim but iconic enough for separate lookup
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_6_PLATFORM,
    make: "Pontiac",
    model: "Trans Am",
    notes: "Top performance Firebird variant. Screaming chicken hood decal. 1973-1974 Super Duty 455 was peak power. 1977+ Bandit movie fame. WS6 package had wider 15x8 wheels. Same platform as base Firebird.",
  },
];

// ============================================================================
// Import Runner
// ============================================================================

async function importGroup6() {
  const BATCH_TAG = "classic-gm-f-body-2-v1";
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Classic Fitment Import - Group 6: GM F-Body 2nd Gen");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Platform: ${GROUP_6_PLATFORM.platformCode}`);
  console.log(`Years: ${GROUP_6_PLATFORM.yearStart}-${GROUP_6_PLATFORM.yearEnd}`);
  console.log(`Batch Tag: ${BATCH_TAG}`);
  console.log(`Records to import: ${GROUP_6_RECORDS.length}`);
  console.log("");
  
  // Pre-check: verify no conflicts
  console.log("[1] Checking for existing records...");
  
  for (const record of GROUP_6_RECORDS) {
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
      console.log(`  ⚠️  Existing: ${record.make} ${record.model} (${existing.length} records) - will update`);
    } else {
      console.log(`  ✓  New: ${record.make} ${record.model}`);
    }
  }
  
  // Run import
  console.log("");
  console.log("[2] Running import...");
  
  const result = await importClassicBatch(GROUP_6_RECORDS, BATCH_TAG);
  
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
  }
  
  // Test API-style lookup
  console.log("");
  console.log("[4] Testing lookups...");
  
  const testCases = [
    { year: 1970, make: "chevrolet", model: "camaro" },
    { year: 1977, make: "pontiac", model: "firebird" },
    { year: 1979, make: "pontiac", model: "trans-am" },
    { year: 1981, make: "chevrolet", model: "camaro" },
    { year: 1969, make: "chevrolet", model: "camaro" },    // Should match 1st gen, not 2nd gen
    { year: 1982, make: "pontiac", model: "firebird" },    // Should NOT match (3rd gen starts)
    { year: 2024, make: "chevrolet", model: "camaro" },    // Should NOT match (modern)
  ];
  
  for (const tc of testCases) {
    const match = await db
      .select()
      .from(classicFitments)
      .where(
        and(
          eq(classicFitments.make, tc.make.toLowerCase()),
          eq(classicFitments.model, tc.model.toLowerCase().replace(/\s+/g, "-")),
          lte(classicFitments.yearStart, tc.year),
          gte(classicFitments.yearEnd, tc.year),
          eq(classicFitments.isActive, true)
        )
      )
      .limit(1);
    
    if (match.length > 0) {
      console.log(`  ✓ ${tc.year} ${tc.make} ${tc.model} → Platform: ${match[0].platformName}`);
    } else {
      console.log(`  ⏭️ ${tc.year} ${tc.make} ${tc.model} → No classic match (expected for out-of-range/modern)`);
    }
  }
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Group 6 Import Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Rollback command (if needed):");
  console.log(`  UPDATE classic_fitments SET is_active = false WHERE batch_tag = '${BATCH_TAG}';`);
  console.log("");
  
  return result;
}

// ============================================================================
// Run
// ============================================================================

importGroup6()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
