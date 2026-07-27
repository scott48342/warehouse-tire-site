/**
 * ADD BUICK REGAL FITMENT DATA (G-body era: 1978-1987)
 * 
 * Based on research:
 * - G-body platform (1978-1987): Buick Regal, Chevy Monte Carlo, Olds Cutlass, Pontiac Grand Prix
 * - Bolt Pattern: 5x120.65mm (5x4.75")
 * - Center Bore: 78.1mm
 * - Thread Size: 7/16"-20
 * - Seat Type: Conical
 * - OEM Wheel: 14x6 or 15x6
 * - OEM Tire: 195/75R14 or 205/70R14
 * - Offset: 0 to +38mm (typical GM RWD)
 * 
 * Run with: npx tsx scripts/add-buick-regal-fitments.ts
 * Add --dry-run to preview without inserting
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { randomUUID } from "crypto";

const DRY_RUN = process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

// G-body Buick Regal generations
const REGAL_FITMENTS = [
  // 2nd Gen G-body: 1978-1987
  {
    yearStart: 1978,
    yearEnd: 1987,
    displayTrim: "Base",
    boltPattern: "5x120.65",
    centerBoreMm: "78.1",
    threadSize: "7/16-20",
    seatType: "Conical",
    offsetMinMm: 0,
    offsetMaxMm: 38,
    oemWheelSizes: [
      { diameter: 14, width: 6, offset: 0 },
      { diameter: 15, width: 6, offset: 38 },
    ],
    oemTireSizes: ["195/75R14", "205/70R14", "215/65R15"],
    source: "manual-research",
    qualityTier: "verified",
  },
  // 3rd Gen W-body: 1988-1996 (front-wheel drive, different platform)
  {
    yearStart: 1988,
    yearEnd: 1996,
    displayTrim: "Base",
    boltPattern: "5x115",
    centerBoreMm: "70.3",
    threadSize: "M12x1.5",
    seatType: "Conical",
    offsetMinMm: 35,
    offsetMaxMm: 46,
    oemWheelSizes: [
      { diameter: 14, width: 5.5, offset: 38 },
      { diameter: 15, width: 6, offset: 38 },
    ],
    oemTireSizes: ["205/70R14", "205/65R15", "215/60R16"],
    source: "manual-research",
    qualityTier: "verified",
  },
  // 4th Gen W-body: 1997-2004
  {
    yearStart: 1997,
    yearEnd: 2004,
    displayTrim: "Base",
    boltPattern: "5x115",
    centerBoreMm: "70.3",
    threadSize: "M12x1.5",
    seatType: "Conical",
    offsetMinMm: 38,
    offsetMaxMm: 50,
    oemWheelSizes: [
      { diameter: 16, width: 6.5, offset: 42 },
      { diameter: 17, width: 7, offset: 42 },
    ],
    oemTireSizes: ["225/60R16", "225/55R17"],
    source: "manual-research",
    qualityTier: "verified",
  },
];

async function main() {
  console.log("🔧 ADD BUICK REGAL FITMENT DATA");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "⚠️ LIVE"}`);
  console.log("");

  const recordsToInsert: any[] = [];

  for (const fitment of REGAL_FITMENTS) {
    for (let year = fitment.yearStart; year <= fitment.yearEnd; year++) {
      const modificationId = `buick-regal-${fitment.displayTrim.toLowerCase().replace(/\s+/g, "-")}-${randomUUID().slice(0, 8)}`;
      
      recordsToInsert.push({
        year,
        make: "Buick",
        model: "Regal",
        rawTrim: fitment.displayTrim,
        displayTrim: fitment.displayTrim,
        modificationId,
        boltPattern: fitment.boltPattern,
        centerBoreMm: fitment.centerBoreMm,
        threadSize: fitment.threadSize,
        seatType: fitment.seatType,
        offsetMinMm: fitment.offsetMinMm,
        offsetMaxMm: fitment.offsetMaxMm,
        oemWheelSizes: fitment.oemWheelSizes,
        oemTireSizes: fitment.oemTireSizes,
        source: fitment.source,
        qualityTier: fitment.qualityTier,
        certificationStatus: "certified",
      });
    }
  }

  console.log(`Prepared ${recordsToInsert.length} records:\n`);
  
  // Group by generation for display
  const byGen: Record<string, number> = {};
  for (const rec of recordsToInsert) {
    const gen = rec.boltPattern === "5x120.65" ? "G-body (1978-1987)" :
                rec.year <= 1996 ? "W-body Gen1 (1988-1996)" :
                "W-body Gen2 (1997-2004)";
    byGen[gen] = (byGen[gen] || 0) + 1;
  }
  
  for (const [gen, count] of Object.entries(byGen)) {
    console.log(`  ${gen}: ${count} records`);
  }
  
  console.log(`\nSample record:`);
  console.log(JSON.stringify(recordsToInsert[6], null, 2)); // 1984 example

  if (DRY_RUN) {
    console.log("\n🔸 DRY RUN - no changes made.");
    await pool.end();
    process.exit(0);
  }

  console.log("\n📝 Inserting records...");
  
  // Insert in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  
  for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
    const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
    await db.insert(vehicleFitments).values(batch);
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${recordsToInsert.length}`);
  }

  console.log(`\n✅ Inserted ${recordsToInsert.length} Buick Regal fitment records`);
  
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Error:", err);
  await pool.end();
  process.exit(1);
});
