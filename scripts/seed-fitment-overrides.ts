/**
 * Seed Fitment Overrides
 * 
 * Adds manual overrides for vehicles where Wheel-Size API lacks technical data.
 * Run: npx tsx scripts/seed-fitment-overrides.ts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface Override {
  scope: "global" | "year" | "make" | "model" | "modification";
  year?: number;
  make?: string;
  model?: string;
  modificationId?: string;
  boltPattern?: string;
  centerBoreMm?: number;
  threadSize?: string;
  seatType?: string;
  offsetMinMm?: number;
  offsetMaxMm?: number;
  reason: string;
}

// ============================================================================
// GM Trucks/SUVs - 6x139.7 (6x5.5) bolt pattern
// ============================================================================

const GM_6LUG_OVERRIDES: Override[] = [
  // 2002-2006 Chevrolet Avalanche 1500
  {
    scope: "model",
    make: "Chevrolet",
    model: "Avalanche 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Wheel-Size API lacks technical data for early Avalanche models",
  },
  
  // 2003-2006 Chevrolet Silverado 1500 (older body style)
  {
    scope: "model",
    year: 2003,
    make: "Chevrolet",
    model: "Silverado 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for pre-2007 Silverado lacking API data",
  },
  {
    scope: "model",
    year: 2004,
    make: "Chevrolet",
    model: "Silverado 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for pre-2007 Silverado lacking API data",
  },
  {
    scope: "model",
    year: 2005,
    make: "Chevrolet",
    model: "Silverado 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for pre-2007 Silverado lacking API data",
  },
  {
    scope: "model",
    year: 2006,
    make: "Chevrolet",
    model: "Silverado 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for pre-2007 Silverado lacking API data",
  },
  
  // GMC Sierra 1500 (same years)
  {
    scope: "model",
    year: 2003,
    make: "GMC",
    model: "Sierra 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for pre-2007 Sierra lacking API data",
  },
  {
    scope: "model",
    year: 2004,
    make: "GMC",
    model: "Sierra 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for pre-2007 Sierra lacking API data",
  },
  {
    scope: "model",
    year: 2005,
    make: "GMC",
    model: "Sierra 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for pre-2007 Sierra lacking API data",
  },
  {
    scope: "model",
    year: 2006,
    make: "GMC",
    model: "Sierra 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for pre-2007 Sierra lacking API data",
  },
  
  // Chevrolet Suburban 1500 (older models)
  {
    scope: "model",
    year: 2003,
    make: "Chevrolet",
    model: "Suburban 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for older Suburban lacking API data",
  },
  {
    scope: "model",
    year: 2004,
    make: "Chevrolet",
    model: "Suburban 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for older Suburban lacking API data",
  },
  {
    scope: "model",
    year: 2005,
    make: "Chevrolet",
    model: "Suburban 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for older Suburban lacking API data",
  },
  {
    scope: "model",
    year: 2006,
    make: "Chevrolet",
    model: "Suburban 1500",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for older Suburban lacking API data",
  },
  
  // Chevrolet Tahoe (older models)
  {
    scope: "model",
    year: 2003,
    make: "Chevrolet",
    model: "Tahoe",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for older Tahoe lacking API data",
  },
  {
    scope: "model",
    year: 2004,
    make: "Chevrolet",
    model: "Tahoe",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for older Tahoe lacking API data",
  },
  {
    scope: "model",
    year: 2005,
    make: "Chevrolet",
    model: "Tahoe",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for older Tahoe lacking API data",
  },
  {
    scope: "model",
    year: 2006,
    make: "Chevrolet",
    model: "Tahoe",
    boltPattern: "6x139.7",
    centerBoreMm: 78.1,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: 25,
    offsetMaxMm: 45,
    reason: "Override for older Tahoe lacking API data",
  },
];

// ============================================================================
// Main
// ============================================================================

async function createOverride(override: Override) {
  const res = await fetch(`${BASE_URL}/api/admin/fitment-override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...override,
      createdBy: "seed-script",
    }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    console.error(`❌ Failed to create override for ${override.make} ${override.model}:`, error);
    return false;
  }
  
  const result = await res.json();
  console.log(`✅ Created override: ${override.make} ${override.model} ${override.year || "(all years)"} → ${result.id}`);
  return true;
}

async function main() {
  console.log("Seeding fitment overrides...\n");
  console.log(`Using API: ${BASE_URL}\n`);
  
  let created = 0;
  let failed = 0;
  
  for (const override of GM_6LUG_OVERRIDES) {
    const success = await createOverride(override);
    if (success) created++;
    else failed++;
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\n✅ Done! Created ${created} overrides, ${failed} failed.`);
}

main().catch(console.error);
