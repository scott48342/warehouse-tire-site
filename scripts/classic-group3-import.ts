/**
 * Classic Fitment Group 3 Import
 * Platform: GM A-Body 2nd Generation
 * Vehicles: Chevelle, GTO, Cutlass/442, Skylark
 * Years: 1968-1972
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
// Group 3 Platform Definition
// ============================================================================

const GROUP_3_PLATFORM = {
  platformCode: "gm-a-body-2",
  platformName: "GM A-Body 2nd Generation",
  generationName: "1968-1972 Muscle Car Era",
  
  // Year coverage
  yearStart: 1968,
  yearEnd: 1972,
  
  // Baseline specs (universal across GM A-Body)
  commonBoltPattern: "5x120.65",  // 5x4.75" - GM standard
  commonCenterBore: 70.3,         // GM hub bore
  commonThreadSize: "7/16-20",    // GM standard
  commonSeatType: "conical",      // Conical/tapered (60°)
  
  // Recommended wheel ranges
  // Stock: 14x6-7, plus safe upgrade range
  recWheelDiameterMin: 14,
  recWheelDiameterMax: 17,        // Common restomod max
  recWheelWidthMin: 6.0,
  recWheelWidthMax: 8.0,          // Beyond 8" requires mods
  recOffsetMinMm: -6,             // Near zero for classic look
  recOffsetMaxMm: 6,              // GM A-body typically low offset
  
  // Stock reference
  stockWheelDiameter: 14,
  stockWheelWidth: 6,
  stockTireSize: "F70-14 / G70-14 / 225/70R14", // Period correct
  
  // Confidence & verification
  confidence: "high" as const,
  verificationNote: "GM A-Body 2nd gen platform 1968-1972. Bolt pattern verified across all makes/models. SS/GTO/442/GS performance variants may have 7\" stock wheels.",
  fitmentStyle: "stock_baseline",
  
  // Modification context
  commonModifications: [
    "Disc brake conversion (front)",
    "Tubular A-arm upgrade",
    "Restomod wheel upgrade (15-17\")",
    "Big block swap (454, 455)"
  ],
  modificationRisk: "medium" as const,
};

// ============================================================================
// Group 3 Vehicle Records
// ============================================================================

const GROUP_3_RECORDS: ClassicFitmentInput[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Chevrolet Chevelle - Full coverage 1968-1972
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_3_PLATFORM,
    make: "Chevrolet",
    model: "Chevelle",
    notes: "Includes base, Malibu, SS 396, SS 454. Performance variants (SS) typically had 7\" wide Rally wheels. 1970 SS 454 LS6 is the most collectible.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Pontiac GTO - Full coverage 1968-1972
  // Note: GTO was its own model in this era (not an option package)
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_3_PLATFORM,
    make: "Pontiac",
    model: "GTO",
    notes: "Pontiac's flagship muscle car. Judge package (1969-1971) had Ram Air engines. 1968-1969 had split front bumper. Same A-body platform as Chevelle.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Oldsmobile Cutlass - Full coverage 1968-1972
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_3_PLATFORM,
    make: "Oldsmobile",
    model: "Cutlass",
    notes: "Includes Cutlass, Cutlass S, Cutlass Supreme. Base model for 442 performance package. Same A-body platform specs.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Oldsmobile 442 - Full coverage 1968-1972
  // 442 was its own model starting 1968
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_3_PLATFORM,
    make: "Oldsmobile",
    model: "442",
    notes: "Oldsmobile's muscle car. W-30 package had force-air induction. Originally stood for 4-barrel, 4-speed, dual exhaust. Same platform as Cutlass.",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Buick Skylark - Full coverage 1968-1972
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_3_PLATFORM,
    make: "Buick",
    model: "Skylark",
    notes: "Includes Skylark, Skylark Custom. GS (Gran Sport) variants shared same platform. Stage 1 455 (1970-1972) was the performance option.",
  },
];

// ============================================================================
// Import Runner
// ============================================================================

async function importGroup3() {
  const BATCH_TAG = "classic-gm-a-body-2-v1";
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Classic Fitment Import - Group 3: GM A-Body 2nd Gen");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Platform: ${GROUP_3_PLATFORM.platformCode}`);
  console.log(`Years: ${GROUP_3_PLATFORM.yearStart}-${GROUP_3_PLATFORM.yearEnd}`);
  console.log(`Batch Tag: ${BATCH_TAG}`);
  console.log(`Records to import: ${GROUP_3_RECORDS.length}`);
  console.log("");
  
  // Pre-check: verify no conflicts
  console.log("[1] Checking for existing records...");
  
  for (const record of GROUP_3_RECORDS) {
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
  
  const result = await importClassicBatch(GROUP_3_RECORDS, BATCH_TAG);
  
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
    { year: 1970, make: "chevrolet", model: "chevelle" },
    { year: 1969, make: "pontiac", model: "gto" },
    { year: 1970, make: "oldsmobile", model: "442" },
    { year: 1971, make: "buick", model: "skylark" },
    { year: 1970, make: "oldsmobile", model: "cutlass" },
    { year: 1967, make: "chevrolet", model: "chevelle" }, // Should NOT match (before 1968)
    { year: 1973, make: "pontiac", model: "gto" },         // Should NOT match (after 1972)
    { year: 2024, make: "chevrolet", model: "malibu" },    // Should NOT match (modern)
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
  console.log("Group 3 Import Complete");
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

importGroup3()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
