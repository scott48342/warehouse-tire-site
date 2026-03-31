/**
 * Fix 1969 Camaro Fitment Data AND Audit Other Classics
 * 
 * This script:
 * 1. Updates the 1969 Camaro vehicle_fitments record with correct OEM wheel sizes
 * 2. Audits all classic vehicles (pre-1985) for incorrect diameter data
 * 
 * Run: npx tsx scripts/fix-1969-camaro-and-audit-classics.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { eq, and, lt } from "drizzle-orm";

// ============================================================================
// Correct OEM Wheel Sizes for 1st Gen F-Body (1967-1969)
// ============================================================================

// These are the ACTUAL stock wheel sizes for 1967-1969 Camaro/Firebird
const CORRECT_1ST_GEN_FBODY_WHEEL_SIZES = [
  { diameter: 14, width: 6, offset: null, tireSize: "E70-14", axle: "both", isStock: true },
  { diameter: 14, width: 7, offset: null, tireSize: "F70-14", axle: "both", isStock: true },
  { diameter: 15, width: 6, offset: null, tireSize: "F60-15", axle: "both", isStock: true },
];

// Stock offset range for 1st gen F-body
const CORRECT_OFFSET_MIN = -6;
const CORRECT_OFFSET_MAX = 25;

// Classic vehicle cutoff year
const CLASSIC_YEAR_CUTOFF = 1985;

// Known classic makes
const CLASSIC_MAKES = new Set([
  "chevrolet", "pontiac", "buick", "oldsmobile", "cadillac",
  "ford", "mercury", "lincoln",
  "dodge", "plymouth", "chrysler",
  "amc", "jeep",
]);

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Fix 1969 Camaro & Audit Classic Vehicles");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Fix 1969 Camaro
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("[1] Fixing 1969 Chevrolet Camaro...\n");
  
  const camaroRecords = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 1969),
        eq(vehicleFitments.make, "chevrolet"),
        eq(vehicleFitments.model, "camaro")
      )
    );

  if (camaroRecords.length === 0) {
    console.log("  ❌ No 1969 Camaro record found in vehicle_fitments");
    console.log("     The record may not exist yet - run the import first.");
  } else {
    console.log(`  Found ${camaroRecords.length} record(s):\n`);

    for (const record of camaroRecords) {
      const currentWheelSizes = record.oemWheelSizes as any[] || [];
      const currentDiameters = currentWheelSizes.map((ws: any) => ws.diameter);
      
      console.log(`  Record: ${record.modificationId}`);
      console.log(`    Display Trim: ${record.displayTrim}`);
      console.log(`    Bolt Pattern: ${record.boltPattern}`);
      console.log(`    Current oemWheelSizes diameters: ${JSON.stringify(currentDiameters)}`);
      console.log(`    Current offsetMinMm: ${record.offsetMinMm}`);
      console.log(`    Current offsetMaxMm: ${record.offsetMaxMm}`);
      
      // Check if fix is needed
      const hasBadData = currentDiameters.some((d: number) => d > 16); // Stock was 14-15", >16 is wrong
      
      if (hasBadData) {
        console.log(`\n    ⚠️  BAD DATA DETECTED: Wheel diameters > 16" are incorrect for 1969 Camaro`);
        console.log(`    Applying fix...`);
        
        await db
          .update(vehicleFitments)
          .set({
            oemWheelSizes: CORRECT_1ST_GEN_FBODY_WHEEL_SIZES,
            offsetMinMm: CORRECT_OFFSET_MIN,
            offsetMaxMm: CORRECT_OFFSET_MAX,
            updatedAt: new Date(),
          })
          .where(eq(vehicleFitments.modificationId, record.modificationId));
        
        console.log(`    ✅ Updated with correct OEM wheel sizes: 14", 14", 15"`);
        console.log(`    ✅ Updated offset range: ${CORRECT_OFFSET_MIN}mm to ${CORRECT_OFFSET_MAX}mm`);
      } else {
        console.log(`    ✓ Data looks correct (no diameters > 16")`);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Audit all classic vehicles
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("\n\n[2] Auditing all classic vehicles (pre-1985)...\n");
  
  const classicRecords = await db
    .select()
    .from(vehicleFitments)
    .where(lt(vehicleFitments.year, CLASSIC_YEAR_CUTOFF));
  
  console.log(`  Found ${classicRecords.length} vehicle_fitments records for pre-${CLASSIC_YEAR_CUTOFF} vehicles\n`);
  
  const suspectRecords: Array<{
    year: number;
    make: string;
    model: string;
    modificationId: string;
    issue: string;
    currentDiameters: number[];
  }> = [];
  
  for (const record of classicRecords) {
    const make = record.make.toLowerCase();
    
    // Only audit classic makes
    if (!CLASSIC_MAKES.has(make)) continue;
    
    const wheelSizes = record.oemWheelSizes as any[] || [];
    const diameters = wheelSizes.map((ws: any) => Number(ws.diameter)).filter(d => d > 0);
    
    // Check for suspicious data
    let issue: string | null = null;
    
    if (diameters.length === 0) {
      issue = "No wheel diameter data";
    } else if (diameters.every(d => d >= 17)) {
      // Pre-1980 vehicles should NOT have only 17"+ wheels
      // Most classics had 14-15" stock, some 70s cars had 15-16"
      if (record.year < 1980) {
        issue = `All diameters ≥ 17" (${diameters.join(", ")}) - suspicious for ${record.year} vehicle`;
      }
    } else if (record.year < 1975 && Math.min(...diameters) > 15) {
      // Pre-1975 cars almost always had 14-15" stock wheels
      issue = `Min diameter > 15" (${diameters.join(", ")}) - suspicious for ${record.year} vehicle`;
    }
    
    if (issue) {
      suspectRecords.push({
        year: record.year,
        make: record.make,
        model: record.model,
        modificationId: record.modificationId,
        issue,
        currentDiameters: diameters,
      });
    }
  }
  
  if (suspectRecords.length === 0) {
    console.log("  ✓ No suspicious diameter data found in classic vehicles");
  } else {
    console.log(`  ⚠️  Found ${suspectRecords.length} records with suspicious diameter data:\n`);
    
    // Group by make/model for cleaner output
    const byVehicle = new Map<string, typeof suspectRecords>();
    for (const rec of suspectRecords) {
      const key = `${rec.year} ${rec.make} ${rec.model}`;
      if (!byVehicle.has(key)) byVehicle.set(key, []);
      byVehicle.get(key)!.push(rec);
    }
    
    for (const [vehicle, records] of byVehicle) {
      console.log(`  ${vehicle}:`);
      for (const rec of records) {
        console.log(`    - ${rec.modificationId}: ${rec.issue}`);
      }
    }
    
    console.log("\n  These records may need manual review/correction.");
    console.log("  For classic vehicles, the classic_fitments table should be the source of truth.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Verify 1969 Camaro fix
  // ──────────────────────────────────────────────────────────────────────────
  
  console.log("\n\n[3] Verification...\n");
  
  const [updatedCamaro] = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 1969),
        eq(vehicleFitments.make, "chevrolet"),
        eq(vehicleFitments.model, "camaro")
      )
    )
    .limit(1);
  
  if (updatedCamaro) {
    const wheelSizes = updatedCamaro.oemWheelSizes as any[] || [];
    const diameters = wheelSizes.map((ws: any) => ws.diameter);
    
    console.log("  1969 Chevrolet Camaro (vehicle_fitments):");
    console.log(`    oemWheelSizes diameters: ${JSON.stringify(diameters)}`);
    console.log(`    offsetMinMm: ${updatedCamaro.offsetMinMm}`);
    console.log(`    offsetMaxMm: ${updatedCamaro.offsetMaxMm}`);
    
    const isCorrect = diameters.includes(14) && diameters.includes(15) && !diameters.some((d: number) => d > 16);
    console.log(`\n    Status: ${isCorrect ? "✅ CORRECT" : "⚠️ NEEDS REVIEW"}`);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Summary");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log("1. 1969 Camaro vehicle_fitments record: UPDATED");
  console.log(`2. Classic vehicles with suspicious data: ${suspectRecords.length}`);
  console.log("3. Remember: classic_fitments table is the source of truth for classic wheel search ranges");
  console.log("\nNext steps:");
  console.log("  - Run classic-group7-import.ts to add 1st gen F-body to classic_fitments");
  console.log("  - The wheel search API now uses classic_fitments ranges for classic vehicles");
  console.log("  - 15, 16, 17, 18, 19, 20 should all be selectable for 1969 Camaro\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
