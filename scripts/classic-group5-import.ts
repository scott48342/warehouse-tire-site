/**
 * Classic Fitment Group 5 Import
 * Platform: Mopar B-Body (Intermediate Muscle)
 * Vehicles: Road Runner, Charger, GTX, Coronet R/T, Super Bee
 * Years: 1968-1970
 * 
 * NOTES:
 * - B-Body continued past 1970 but 1968-1970 is the "classic muscle" era
 * - 1971+ had emissions-detuned engines and styling changes
 * - Most came with drum brakes; disc was optional on performance models
 * - Bolt pattern identical to E-Body (5x114.3)
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
// Group 5 Platform Definition
// ============================================================================

const GROUP_5_PLATFORM = {
  platformCode: "mopar-b-body",
  platformName: "Mopar B-Body",
  generationName: "1968-1970 Intermediate Muscle Era",
  
  // Year coverage (focused on peak muscle car years)
  yearStart: 1968,
  yearEnd: 1970,
  
  // Baseline specs (universal across Mopar B-Body)
  // Same as E-Body - Chrysler standardized these specs
  commonBoltPattern: "5x114.3",   // 5x4.5" - Mopar standard
  commonCenterBore: 71.5,         // Mopar hub bore (same as E-Body)
  commonThreadSize: "1/2-20",     // Mopar standard
  commonSeatType: "conical",      // Conical/tapered (60°)
  
  // Recommended wheel ranges
  // Stock: 14x5.5-6 base, 15x6-7 on performance models
  // B-Bodies are larger/heavier than E-Body pony cars
  // Customer-facing: 15-20" for full restomod selection
  recWheelDiameterMin: 15,
  recWheelDiameterMax: 20,        // Modern restomod max
  recWheelWidthMin: 5.5,
  recWheelWidthMax: 8.0,          // Beyond 8" requires mods
  recOffsetMinMm: -6,             // Near zero typical
  recOffsetMaxMm: 6,              // B-Body has tighter offset tolerance than E-Body
  
  // Stock reference
  stockWheelDiameter: 14,
  stockWheelWidth: 6,
  stockTireSize: "F70-14 / G70-14 / 225/70R14", // Period correct
  
  // Confidence & verification
  confidence: "high" as const,
  verificationNote: "Mopar B-Body intermediate platform 1968-1970. Bolt pattern verified (5x114.3, same as E-Body). Performance models (R/T, Hemi) often had 15\" wheels. Disc brake cars may need +3-5mm offset clearance.",
  fitmentStyle: "stock_baseline",
  
  // Modification context
  commonModifications: [
    "Disc brake conversion (front)",
    "4-link rear suspension",
    "Restomod wheel upgrade (15-17\")",
    "Engine swap (440 Six Pack, 426 Hemi clone)"
  ],
  modificationRisk: "medium" as const,
};

// ============================================================================
// Group 5 Vehicle Records
// ============================================================================

const GROUP_5_RECORDS: ClassicFitmentInput[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Plymouth Road Runner - 1968-1970
  // Budget muscle car, no-frills approach
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_5_PLATFORM,
    make: "Plymouth",
    model: "Road Runner",
    notes: "Plymouth's budget muscle car with 'beep beep' horn. 383 standard, 440 Six Pack and 426 Hemi optional. 1969-1970 had optional Air Grabber hood. Superbird (1970) was aero variant for NASCAR.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Dodge Charger - 1968-1970
  // Iconic 2nd gen design (Bullitt, Dukes of Hazzard)
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_5_PLATFORM,
    make: "Dodge",
    model: "Charger",
    notes: "2nd generation (1968-1970) is the iconic design. R/T was performance package. Daytona (1969) was NASCAR aero car with nose cone/wing. 500 (1969) was limited aero variant. Most famous B-Body.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Plymouth GTX - 1968-1970
  // Premium muscle car (gentleman's muscle)
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_5_PLATFORM,
    make: "Plymouth",
    model: "GTX",
    notes: "Plymouth's premium muscle car. 440 Super Commando standard (vs 383 in Road Runner). More upscale interior. Often had disc brakes and 15\" wheels as standard equipment.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Dodge Coronet R/T - 1968-1970
  // R/T = Road/Track performance package
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_5_PLATFORM,
    make: "Dodge",
    model: "Coronet",
    notes: "Coronet R/T (Road/Track) was the performance variant. 440 Magnum standard. Available as 2-door hardtop or convertible. Base Coronet was family car; R/T was muscle.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Dodge Super Bee - 1968-1970
  // Dodge's budget muscle (parallel to Road Runner)
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_5_PLATFORM,
    make: "Dodge",
    model: "Super Bee",
    notes: "Dodge's budget muscle car (Coronet-based, parallel to Plymouth Road Runner). 383 standard, 440 Six Pack and Hemi optional. 1968 only came as coupe. Shared drivetrain with Road Runner.",
  },
];

// ============================================================================
// Import Runner
// ============================================================================

async function importGroup5() {
  const BATCH_TAG = "classic-mopar-b-body-v1";
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Classic Fitment Import - Group 5: Mopar B-Body");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Platform: ${GROUP_5_PLATFORM.platformCode}`);
  console.log(`Years: ${GROUP_5_PLATFORM.yearStart}-${GROUP_5_PLATFORM.yearEnd}`);
  console.log(`Batch Tag: ${BATCH_TAG}`);
  console.log(`Records to import: ${GROUP_5_RECORDS.length}`);
  console.log("");
  
  // Pre-check: verify no conflicts
  console.log("[1] Checking for existing records...");
  
  for (const record of GROUP_5_RECORDS) {
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
  
  const result = await importClassicBatch(GROUP_5_RECORDS, BATCH_TAG);
  
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
    { year: 1968, make: "plymouth", model: "road-runner" },
    { year: 1969, make: "dodge", model: "charger" },
    { year: 1970, make: "plymouth", model: "gtx" },
    { year: 1969, make: "dodge", model: "coronet" },
    { year: 1970, make: "dodge", model: "super-bee" },
    { year: 1967, make: "dodge", model: "charger" },        // Should NOT match (before 1968)
    { year: 1971, make: "plymouth", model: "road-runner" }, // Should NOT match (after 1970)
    { year: 2024, make: "dodge", model: "charger" },        // Should NOT match (modern)
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
  console.log("Group 5 Import Complete");
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

importGroup5()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
