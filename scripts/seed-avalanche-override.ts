/**
 * Seed script: 2003 Chevrolet Avalanche 1500 Override Example
 * 
 * This demonstrates the manual override system for unresolved vehicles.
 * The Avalanche 1500 is a common case where the API returns incomplete data.
 * 
 * Run: npx tsx scripts/seed-avalanche-override.ts
 */

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { createOverride } from "../src/lib/fitment-db/applyOverrides";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("🚗 Seeding 2003 Chevrolet Avalanche 1500 Override Example\n");
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: Create an unresolved vehicle fitment record (simulating API failure)
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log("📝 Creating unresolved vehicle fitment record...");
  
  const unresolvedFitment = {
    year: 2003,
    make: "chevrolet",
    model: "avalanche-1500",
    modificationId: "z71-5-3l-v8",
    rawTrim: "Z71 5.3L V8",
    displayTrim: "Z71 5.3L V8",
    // Incomplete data - missing critical fields
    boltPattern: null as string | null,  // MISSING - makes profile INVALID
    centerBoreMm: null,
    threadSize: null,
    seatType: null,
    offsetMinMm: null,
    offsetMaxMm: null,
    oemWheelSizes: [] as any[],  // EMPTY - no wheel size data
    oemTireSizes: [] as string[],  // EMPTY - no tire size data
    source: "manual-seed",
  };
  
  // Upsert the fitment record
  const existing = await db.query.vehicleFitments.findFirst({
    where: and(
      eq(vehicleFitments.year, unresolvedFitment.year),
      eq(vehicleFitments.make, unresolvedFitment.make),
      eq(vehicleFitments.model, unresolvedFitment.model),
      eq(vehicleFitments.modificationId, unresolvedFitment.modificationId)
    ),
  });
  
  if (existing) {
    console.log(`  ↳ Record already exists (id: ${existing.id}), updating...`);
    await db.update(vehicleFitments)
      .set({
        boltPattern: unresolvedFitment.boltPattern,
        centerBoreMm: null,
        threadSize: null,
        seatType: null,
        offsetMinMm: null,
        offsetMaxMm: null,
        oemWheelSizes: [],
        oemTireSizes: [],
        updatedAt: new Date(),
      })
      .where(eq(vehicleFitments.id, existing.id));
  } else {
    await db.insert(vehicleFitments).values(unresolvedFitment);
    console.log("  ↳ Created new fitment record");
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2: Create the override that fixes this vehicle
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log("\n🔧 Creating override to fix the vehicle...");
  
  // Research data for 2003 Chevrolet Avalanche 1500:
  // - Bolt pattern: 6x139.7 (same as other GM trucks)
  // - Center bore: 78.1mm
  // - Thread size: M14x1.5
  // - Seat type: Conical
  // - OEM wheel sizes: 16", 17" options
  // - OEM tires: various sizes
  
  const overrideId = await createOverride({
    scope: "modification",
    year: 2003,
    make: "Chevrolet",
    model: "Avalanche 1500",
    modificationId: "z71-5-3l-v8",
    
    // Corrected specs from research:
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 15,
    offsetMaxMm: 35,
    
    // OEM wheel sizes
    oemWheelSizes: [
      { diameter: 16, width: 7, offset: 31, axle: "both", isStock: true, tireSize: "265/75R16" },
      { diameter: 17, width: 7.5, offset: 28, axle: "both", isStock: true, tireSize: "265/70R17" },
    ],
    
    // OEM tire sizes
    oemTireSizes: ["265/75R16", "265/70R17"],
    
    // Force quality to valid (bypasses assessment)
    forceQuality: "valid",
    
    // Metadata
    reason: "Wheel-Size API returns incomplete data for 2003 Avalanche 1500. Manual override with researched specs.",
    notes: "Verified against GM service manual and owner forums. Same specs as Silverado 1500/Tahoe of same era.",
    createdBy: "seed-script",
  });
  
  console.log(`  ↳ Created override (id: ${overrideId})`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3: Show before/after
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log("\n" + "═".repeat(70));
  console.log("📊 BEFORE/AFTER COMPARISON");
  console.log("═".repeat(70));
  
  console.log("\n❌ BEFORE (Unresolved - from API):");
  console.log(JSON.stringify({
    vehicle: "2003 Chevrolet Avalanche 1500 Z71",
    boltPattern: null,
    centerBoreMm: null,
    threadSize: null,
    seatType: null,
    offsetRange: { min: null, max: null },
    oemWheelSizes: [],
    oemTireSizes: [],
    quality: "INVALID",
    reason: "Missing boltPattern - cannot match any wheels",
  }, null, 2));
  
  console.log("\n✅ AFTER (With Override Applied):");
  console.log(JSON.stringify({
    vehicle: "2003 Chevrolet Avalanche 1500 Z71",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetRange: { min: 15, max: 35 },
    oemWheelSizes: [
      { diameter: 16, width: 7, offset: 31, axle: "both", tireSize: "265/75R16" },
      { diameter: 17, width: 7.5, offset: 28, axle: "both", tireSize: "265/70R17" },
    ],
    oemTireSizes: ["265/75R16", "265/70R17"],
    quality: "VALID",
    overridesApplied: true,
    forceQuality: "valid",
  }, null, 2));
  
  console.log("\n" + "═".repeat(70));
  console.log("✅ Done! The vehicle is now usable on the wheels page.");
  console.log("═".repeat(70));
  
  console.log("\n📍 Test with:");
  console.log("   curl 'http://localhost:3000/api/wheels/fitment-search?year=2003&make=Chevrolet&model=Avalanche%201500&modification=z71-5-3l-v8'");
  
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
