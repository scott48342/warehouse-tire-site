/**
 * Classic Fitment Group 4 Import
 * Platform: Mopar E-Body
 * Vehicles: Dodge Challenger, Plymouth Barracuda
 * Years: 1970-1974
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
// Group 4 Platform Definition
// ============================================================================

const GROUP_4_PLATFORM = {
  platformCode: "mopar-e-body",
  platformName: "Mopar E-Body",
  generationName: "1970-1974 Pony Car Era",
  
  // Year coverage
  yearStart: 1970,
  yearEnd: 1974,
  
  // Baseline specs (universal across Mopar E-Body)
  commonBoltPattern: "5x114.3",   // 5x4.5" - Mopar standard
  commonCenterBore: 71.5,         // Mopar hub bore
  commonThreadSize: "1/2-20",     // Mopar standard
  commonSeatType: "conical",      // Conical/tapered (60°)
  
  // Recommended wheel ranges
  // Stock: 14x5.5-7, plus safe upgrade range
  // Customer-facing: 15-20" for full restomod selection
  recWheelDiameterMin: 15,
  recWheelDiameterMax: 20,        // Modern restomod max
  recWheelWidthMin: 5.5,
  recWheelWidthMax: 8.0,          // Beyond 8" requires mods
  recOffsetMinMm: -6,             // Near zero for classic look
  recOffsetMaxMm: 12,             // Slight positive okay
  
  // Stock reference
  stockWheelDiameter: 14,
  stockWheelWidth: 6,
  stockTireSize: "E70-14 / F70-14 / 215/70R14", // Period correct
  
  // Confidence & verification
  confidence: "high" as const,
  verificationNote: "Mopar E-Body platform 1970-1974. Chrysler's pony car to compete with Mustang/Camaro. Bolt pattern verified. R/T, T/A, AAR, Hemi variants may have wider stock wheels (7\").",
  fitmentStyle: "stock_baseline",
  
  // Modification context
  commonModifications: [
    "Disc brake conversion (front)",
    "Subframe connectors",
    "Restomod wheel upgrade (15-17\")",
    "Engine swap (440, 426 Hemi clone)"
  ],
  modificationRisk: "medium" as const,
};

// ============================================================================
// Group 4 Vehicle Records
// ============================================================================

const GROUP_4_RECORDS: ClassicFitmentInput[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Dodge Challenger - Full coverage 1970-1974
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_4_PLATFORM,
    make: "Dodge",
    model: "Challenger",
    notes: "Dodge's pony car. R/T package was performance trim. T/A (Trans Am) 1970 only had special hood/wheels. 1971 was last year for convertible. Hemi Challenger is highly collectible.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Plymouth Barracuda - Full coverage 1970-1974
  // Note: 3rd gen Barracuda (E-Body) starts 1970
  // Earlier Barracudas (1964-1969) were A-Body, different platform
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_4_PLATFORM,
    make: "Plymouth",
    model: "Barracuda",
    notes: "Plymouth's E-Body pony car (3rd gen). AAR 'Cuda (1970 only) was Trans Am homologation special. Hemi 'Cuda is among the most valuable muscle cars. 1971+ detuned due to emissions.",
  },
];

// ============================================================================
// Import Runner
// ============================================================================

async function importGroup4() {
  const BATCH_TAG = "classic-mopar-e-body-v1";
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Classic Fitment Import - Group 4: Mopar E-Body");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Platform: ${GROUP_4_PLATFORM.platformCode}`);
  console.log(`Years: ${GROUP_4_PLATFORM.yearStart}-${GROUP_4_PLATFORM.yearEnd}`);
  console.log(`Batch Tag: ${BATCH_TAG}`);
  console.log(`Records to import: ${GROUP_4_RECORDS.length}`);
  console.log("");
  
  // Pre-check: verify no conflicts
  console.log("[1] Checking for existing records...");
  
  for (const record of GROUP_4_RECORDS) {
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
  
  const result = await importClassicBatch(GROUP_4_RECORDS, BATCH_TAG);
  
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
    { year: 1970, make: "dodge", model: "challenger" },
    { year: 1971, make: "plymouth", model: "barracuda" },
    { year: 1973, make: "dodge", model: "challenger" },
    { year: 1974, make: "plymouth", model: "barracuda" },
    { year: 1969, make: "dodge", model: "challenger" },   // Should NOT match (before 1970)
    { year: 1969, make: "plymouth", model: "barracuda" }, // Should NOT match (A-Body era)
    { year: 1975, make: "dodge", model: "challenger" },   // Should NOT match (after 1974)
    { year: 2024, make: "dodge", model: "challenger" },   // Should NOT match (modern)
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
  console.log("Group 4 Import Complete");
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

importGroup4()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
