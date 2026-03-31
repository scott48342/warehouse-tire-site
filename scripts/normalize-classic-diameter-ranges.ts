/**
 * Normalize Classic Platform Diameter Ranges
 * 
 * Updates all classic_fitments records to use 15-20" diameter range
 * for the standard restomod experience.
 * 
 * SAFE CHANGES:
 * - Only updates recWheelDiameterMin and recWheelDiameterMax
 * - Keeps stockWheelDiameter unchanged (honest stock reference)
 * - Only affects classic_fitments table (not vehicle_fitments)
 * - Modern vehicles unaffected
 * 
 * Run: npx tsx scripts/normalize-classic-diameter-ranges.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/fitment-db/db";
import { classicFitments } from "../src/lib/classic-fitment/schema";
import { eq, sql } from "drizzle-orm";

// ============================================================================
// Target Diameter Range for All Classic Muscle Platforms
// ============================================================================

const TARGET_DIAMETER_MIN = 15;
const TARGET_DIAMETER_MAX = 20;

// Platforms to update (all core muscle car platforms)
const PLATFORMS_TO_UPDATE = [
  "ford-mustang-1gen",   // Group 2: 1964-1973 Mustang/Cougar
  "gm-a-body-2",         // Group 3: 1968-1972 Chevelle/GTO/442/Skylark
  "mopar-e-body",        // Group 4: 1970-1974 Challenger/Barracuda
  "mopar-b-body",        // Group 5: 1968-1970 Charger/Road Runner/GTX
  "gm-f-body-2",         // Group 6: 1970-1981 Camaro/Firebird/Trans Am
  "gm-f-body-1",         // Group 7: 1967-1969 Camaro/Firebird (already correct)
];

// ============================================================================
// Main Update Function
// ============================================================================

async function normalizeClassicDiameterRanges() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Normalize Classic Platform Diameter Ranges");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`Target range: ${TARGET_DIAMETER_MIN}" - ${TARGET_DIAMETER_MAX}"\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Audit current state
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("[1] Auditing current ranges...\n");
  
  const allRecords = await db
    .select({
      platformCode: classicFitments.platformCode,
      platformName: classicFitments.platformName,
      make: classicFitments.make,
      model: classicFitments.model,
      stockDiameter: classicFitments.stockWheelDiameter,
      currentMin: classicFitments.recWheelDiameterMin,
      currentMax: classicFitments.recWheelDiameterMax,
    })
    .from(classicFitments)
    .where(eq(classicFitments.isActive, true));

  const platformSummary = new Map<string, {
    name: string;
    stockDiameter: number | null;
    currentMin: number | null;
    currentMax: number | null;
    vehicles: string[];
    needsUpdate: boolean;
  }>();

  for (const record of allRecords) {
    if (!platformSummary.has(record.platformCode)) {
      const needsUpdate = 
        record.currentMin !== TARGET_DIAMETER_MIN || 
        record.currentMax !== TARGET_DIAMETER_MAX;
      
      platformSummary.set(record.platformCode, {
        name: record.platformName,
        stockDiameter: record.stockDiameter,
        currentMin: record.currentMin,
        currentMax: record.currentMax,
        vehicles: [],
        needsUpdate,
      });
    }
    platformSummary.get(record.platformCode)!.vehicles.push(`${record.make} ${record.model}`);
  }

  console.log("  Platform                          | Stock | Current   | Needs Update");
  console.log("  ----------------------------------|-------|-----------|-------------");
  
  for (const [code, data] of platformSummary) {
    const stock = data.stockDiameter ? `${data.stockDiameter}"` : "N/A";
    const current = `${data.currentMin || "?"}-${data.currentMax || "?"}"`;
    const status = data.needsUpdate ? "⚠️  YES" : "✅ NO";
    console.log(`  ${data.name.padEnd(35)} | ${stock.padEnd(5)} | ${current.padEnd(9)} | ${status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Update ranges
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("\n[2] Updating diameter ranges...\n");
  
  let totalUpdated = 0;
  
  for (const platformCode of PLATFORMS_TO_UPDATE) {
    const summary = platformSummary.get(platformCode);
    
    if (!summary) {
      console.log(`  ⚠️  Platform ${platformCode}: NOT FOUND in database`);
      continue;
    }
    
    if (!summary.needsUpdate) {
      console.log(`  ✓  ${summary.name}: Already at target (${TARGET_DIAMETER_MIN}-${TARGET_DIAMETER_MAX}")`);
      continue;
    }
    
    // Update all records for this platform
    const result = await db
      .update(classicFitments)
      .set({
        recWheelDiameterMin: TARGET_DIAMETER_MIN,
        recWheelDiameterMax: TARGET_DIAMETER_MAX,
        updatedAt: new Date(),
      })
      .where(eq(classicFitments.platformCode, platformCode));
    
    console.log(`  ✅ ${summary.name}: ${summary.currentMin}-${summary.currentMax}" → ${TARGET_DIAMETER_MIN}-${TARGET_DIAMETER_MAX}"`);
    totalUpdated++;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Verify updates
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("\n[3] Verifying updates...\n");
  
  const verifyRecords = await db
    .select({
      platformCode: classicFitments.platformCode,
      platformName: classicFitments.platformName,
      stockDiameter: classicFitments.stockWheelDiameter,
      newMin: classicFitments.recWheelDiameterMin,
      newMax: classicFitments.recWheelDiameterMax,
    })
    .from(classicFitments)
    .where(eq(classicFitments.isActive, true));

  const verifiedPlatforms = new Set<string>();
  
  console.log("  Platform                          | Stock | New Range | Status");
  console.log("  ----------------------------------|-------|-----------|--------");
  
  for (const record of verifyRecords) {
    if (verifiedPlatforms.has(record.platformCode)) continue;
    verifiedPlatforms.add(record.platformCode);
    
    const stock = record.stockDiameter ? `${record.stockDiameter}"` : "N/A";
    const newRange = `${record.newMin}-${record.newMax}"`;
    const correct = record.newMin === TARGET_DIAMETER_MIN && record.newMax === TARGET_DIAMETER_MAX;
    const status = correct ? "✅" : "⚠️";
    console.log(`  ${record.platformName.padEnd(35)} | ${stock.padEnd(5)} | ${newRange.padEnd(9)} | ${status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Summary");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`Platforms updated: ${totalUpdated}`);
  console.log(`Target diameter range: ${TARGET_DIAMETER_MIN}" - ${TARGET_DIAMETER_MAX}"`);
  console.log("\nCustomer-facing selectable diameters: 15, 16, 17, 18, 19, 20");
  console.log("\nStock references preserved (honest):");
  console.log("  - Most platforms: 14\" stock");
  console.log("  - GM F-Body 2nd Gen: 15\" stock");
  console.log("\nModern vehicles: UNCHANGED (classic fallback only affects pre-1985)");
  console.log("");
}

normalizeClassicDiameterRanges()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
