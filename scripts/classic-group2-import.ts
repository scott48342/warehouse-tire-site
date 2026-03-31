/**
 * Classic Fitment Group 2 Import
 * Platform: Ford Mustang 1st Generation
 * Vehicles: Ford Mustang, Mercury Cougar
 * Years: 1964-1973
 * 
 * RULES:
 * - All data goes to classic_fitments table ONLY
 * - No modifications to vehicle_fitments
 * - Surgical rollback via batch_tag
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local for database credentials
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
import { importClassicBatch } from "../src/lib/classic-fitment/classicImport";
import { db } from "../src/lib/fitment-db/db";
import { classicFitments } from "../src/lib/classic-fitment/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import type { ClassicFitmentInput } from "../src/lib/classic-fitment/types";

// ============================================================================
// Group 2 Platform Definition
// ============================================================================

const GROUP_2_PLATFORM = {
  platformCode: "ford-mustang-1gen",
  platformName: "Ford Mustang 1st Generation",
  generationName: "1964.5-1973 Pony Car Era",
  
  // Year coverage
  yearStart: 1964,
  yearEnd: 1973,
  
  // Baseline specs (universal across platform)
  commonBoltPattern: "5x114.3",  // 5x4.5" - Ford standard
  commonCenterBore: 70.6,        // Ford hub bore
  commonThreadSize: "1/2-20",    // Ford standard
  commonSeatType: "conical",     // Conical/tapered (60°)
  
  // Recommended wheel ranges
  // Stock: 14x5.5-6, plus safe upgrade range
  // Customer-facing: 15-20" for full restomod selection
  recWheelDiameterMin: 15,
  recWheelDiameterMax: 20,       // Modern restomod max
  recWheelWidthMin: 5.5,
  recWheelWidthMax: 8.0,         // Beyond 8" requires mods
  recOffsetMinMm: -6,            // Near zero for classic look
  recOffsetMaxMm: 12,            // Slight positive for modern tires
  
  // Stock reference
  stockWheelDiameter: 14,
  stockWheelWidth: 5.5,
  stockTireSize: "C78-14 / 195/75R14", // Period correct
  
  // Confidence & verification
  confidence: "high" as const,
  verificationNote: "Ford pony car platform 1964.5-1973. Bolt pattern verified across all years. Boss/Shelby variants may have wider stock wheels.",
  fitmentStyle: "stock_baseline",
  
  // Modification context
  commonModifications: [
    "Disc brake conversion (front)",
    "Shelby drop (lowering)",
    "Restomod wheel upgrade (15-17\")",
    "Engine swap (302, 351W common)"
  ],
  modificationRisk: "medium" as const,
};

// ============================================================================
// Group 2 Vehicle Records
// ============================================================================

const GROUP_2_RECORDS: ClassicFitmentInput[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Ford Mustang - Full coverage 1964-1973
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_2_PLATFORM,
    make: "Ford",
    model: "Mustang",
    notes: "Includes base, GT, Boss 302, Boss 429, Mach 1, Shelby GT350/GT500. Performance variants may have wider stock wheels (7\" on Boss/Shelby).",
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Mercury Cougar - Full coverage 1967-1973
  // Note: Cougar didn't exist until 1967 (first year)
  // ─────────────────────────────────────────────────────────────────────────
  {
    ...GROUP_2_PLATFORM,
    make: "Mercury",
    model: "Cougar",
    yearStart: 1967, // Cougar introduced in 1967
    yearEnd: 1973,
    notes: "Mercury's luxury pony car. Same Mustang platform. XR-7, Eliminator, and GT-E variants available. Generally had slightly different offset due to wider body.",
  },
];

// ============================================================================
// Import Runner
// ============================================================================

async function importGroup2() {
  const BATCH_TAG = "classic-ford-mustang-1gen-v1";
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Classic Fitment Import - Group 2: Ford Mustang 1st Gen");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Platform: ${GROUP_2_PLATFORM.platformCode}`);
  console.log(`Years: ${GROUP_2_PLATFORM.yearStart}-${GROUP_2_PLATFORM.yearEnd}`);
  console.log(`Batch Tag: ${BATCH_TAG}`);
  console.log(`Records to import: ${GROUP_2_RECORDS.length}`);
  console.log("");
  
  // Pre-check: verify no conflicts
  console.log("[1] Checking for existing records...");
  
  for (const record of GROUP_2_RECORDS) {
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
  
  const result = await importClassicBatch(GROUP_2_RECORDS, BATCH_TAG);
  
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
    { year: 1965, make: "ford", model: "mustang" },
    { year: 1968, make: "mercury", model: "cougar" },
    { year: 1970, make: "ford", model: "mustang" },
    { year: 1965, make: "mercury", model: "cougar" }, // Should NOT match (Cougar starts 1967)
    { year: 2024, make: "ford", model: "mustang" },   // Should NOT match (modern)
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
      console.log(`  ⏭️ ${tc.year} ${tc.make} ${tc.model} → No classic match (expected for modern/pre-production)`);
    }
  }
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Group 2 Import Complete");
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

importGroup2()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
