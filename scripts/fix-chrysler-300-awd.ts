/**
 * Fix Chrysler 300 AWD fitment data
 * 
 * Problem: AWD modifications have all tire sizes (17", 18", 19", 20")
 * Reality: AWD trims ONLY have 19" wheels (235/55R19)
 * 
 * Source: OEM fitment data shows:
 * - C (AWD): 19x7.5 / P235/55R19
 * - C Platinum (AWD): 19x7.5 / P235/55R19  
 * - Limited (AWD): 19x7.5 / P235/55R19
 * - S (AWD): 19x7.5 / P235/55R19
 */

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { eq, and, like } from "drizzle-orm";

async function fixChrysler300AWD() {
  console.log("Fixing 2015 Chrysler 300 AWD fitment data...\n");

  // Find all AWD modifications for 2015 Chrysler 300
  const awdFitments = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 2015),
        eq(vehicleFitments.makeKey, "chrysler"),
        eq(vehicleFitments.modelKey, "300"),
        like(vehicleFitments.modificationId, "%awd%")
      )
    );

  console.log(`Found ${awdFitments.length} AWD fitment records:`);
  for (const f of awdFitments) {
    console.log(`  - ${f.modificationId}: ${f.displayTrim}`);
    console.log(`    Current tire sizes: ${JSON.stringify(f.oemTireSizes)}`);
    console.log(`    Current wheel sizes: ${JSON.stringify(f.oemWheelSizes)}`);
  }

  if (awdFitments.length === 0) {
    console.log("No AWD fitments found!");
    process.exit(1);
  }

  // Correct data for AWD trims: only 19" wheels with 235/55R19 tires
  const correctTireSizes = ["235/55R19"];
  const correctWheelSizes = [
    { diameter: 19, width: 7.5, offset: null, tireSize: "235/55R19", axle: "both", isStock: true }
  ];

  console.log("\nUpdating to correct AWD-only sizes:");
  console.log(`  Tire sizes: ${JSON.stringify(correctTireSizes)}`);
  console.log(`  Wheel sizes: ${JSON.stringify(correctWheelSizes)}`);

  // Update each AWD fitment
  for (const f of awdFitments) {
    await db
      .update(vehicleFitments)
      .set({
        oemTireSizes: correctTireSizes,
        oemWheelSizes: correctWheelSizes,
      })
      .where(eq(vehicleFitments.id, f.id));
    
    console.log(`  ✓ Updated ${f.modificationId}`);
  }

  console.log("\n✅ Fix complete!");
  process.exit(0);
}

fixChrysler300AWD().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
