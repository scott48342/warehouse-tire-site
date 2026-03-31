/**
 * Fix 1969 Camaro Fitment Data
 * 
 * Problem: The vehicle_fitments record has incorrect oemWheelSizes (17" instead of 14/15")
 * This blocks 15" wheel searches since envelope min is 17".
 * 
 * Run: npx tsx scripts/fix-1969-camaro-fitment.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { eq, and } from "drizzle-orm";

// 1st Gen F-Body correct specs (1967-1969 Camaro/Firebird)
const CORRECT_OEM_WHEEL_SIZES = [
  { diameter: 14, width: 6, offset: null, tireSize: "E70-14", axle: "both", isStock: true },
  { diameter: 14, width: 7, offset: null, tireSize: "F70-14", axle: "both", isStock: true },
  { diameter: 15, width: 6, offset: null, tireSize: "F60-15", axle: "both", isStock: true },
];

// Correct offset range for 1st gen F-body
// Stock wheels had very low offset (-6 to +12mm typical)
const CORRECT_OFFSET_MIN = -6;
const CORRECT_OFFSET_MAX = 12;

async function fixCamaroFitment() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Fix 1969 Camaro Fitment Data");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Find the 1969 Camaro record
  const records = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 1969),
        eq(vehicleFitments.make, "chevrolet"),
        eq(vehicleFitments.model, "camaro")
      )
    );

  if (records.length === 0) {
    console.log("❌ No 1969 Camaro record found in vehicle_fitments");
    return;
  }

  console.log(`Found ${records.length} record(s):\n`);

  for (const record of records) {
    console.log(`  ID: ${record.modificationId}`);
    console.log(`  Display Trim: ${record.displayTrim}`);
    console.log(`  Bolt Pattern: ${record.boltPattern}`);
    console.log(`  Current oemWheelSizes: ${JSON.stringify(record.oemWheelSizes)}`);
    console.log(`  Current oemTireSizes: ${JSON.stringify(record.oemTireSizes)}`);
    console.log(`  Current offsetMinMm: ${record.offsetMinMm}`);
    console.log(`  Current offsetMaxMm: ${record.offsetMaxMm}`);
    console.log("");
  }

  // Update the first record (should be manual_239efd4796bd)
  const target = records[0];
  
  console.log("Applying fix...\n");
  console.log(`  Setting oemWheelSizes to: ${JSON.stringify(CORRECT_OEM_WHEEL_SIZES)}`);
  console.log(`  Setting offsetMinMm to: ${CORRECT_OFFSET_MIN}`);
  console.log(`  Setting offsetMaxMm to: ${CORRECT_OFFSET_MAX}`);

  await db
    .update(vehicleFitments)
    .set({
      oemWheelSizes: CORRECT_OEM_WHEEL_SIZES,
      offsetMinMm: CORRECT_OFFSET_MIN,
      offsetMaxMm: CORRECT_OFFSET_MAX,
      updatedAt: new Date(),
    })
    .where(eq(vehicleFitments.modificationId, target.modificationId));

  console.log("\n✅ Update complete!");

  // Verify the fix
  const [updated] = await db
    .select()
    .from(vehicleFitments)
    .where(eq(vehicleFitments.modificationId, target.modificationId));

  console.log("\nVerification:");
  console.log(`  New oemWheelSizes: ${JSON.stringify(updated.oemWheelSizes)}`);
  console.log(`  New offsetMinMm: ${updated.offsetMinMm}`);
  console.log(`  New offsetMaxMm: ${updated.offsetMaxMm}`);

  // Calculate expected envelope
  console.log("\nExpected envelope after fix:");
  console.log("  OEM diameter range: 14-15\"");
  console.log("  Aftermarket safe (+2\"): 14-17\"");
  console.log("  Aggressive (+4\"): 14-19\"");
  console.log("\n15\" filter should now work! 🎉");
}

fixCamaroFitment()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
