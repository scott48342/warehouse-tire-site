/**
 * Add GMC Safari fitment data (1999-2005)
 * 
 * Specs from autofiles.com:
 * - Bolt pattern: 6x139.7
 * - Center bore: 78.3mm
 * - Thread size: M14 x 1.5
 * - Offset range: 10-20mm
 * - OEM wheel: 15x6
 * - OEM tires: P205/75R15, P215/70R15
 * 
 * Run with: npx tsx scripts/add-gmc-safari.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

const db = drizzle(pool);

async function main() {
  const years = [1999, 2000, 2001, 2002, 2003, 2004, 2005];
  
  // Safari trims - kept simple since it's a minivan
  const trims = [
    { modificationId: "base", displayTrim: "Base" },
    { modificationId: "sle", displayTrim: "SLE" },
    { modificationId: "slt", displayTrim: "SLT" },
  ];
  
  // OEM specs
  const specs = {
    boltPattern: "6x139.7",
    centerBoreMm: "78.3",
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetMinMm: "10",
    offsetMaxMm: "20",
    oemWheelSizes: [
      { diameter: 15, width: 6, offset: 15, axle: "front", isStock: true },
      { diameter: 15, width: 6, offset: 15, axle: "rear", isStock: true },
    ],
    oemTireSizes: ["P205/75R15", "P215/70R15"],
  };
  
  console.log("Adding GMC Safari fitment data...");
  
  let inserted = 0;
  let skipped = 0;
  
  for (const year of years) {
    for (const trim of trims) {
      try {
        const result = await db.insert(vehicleFitments).values({
          year,
          make: "GMC",
          model: "Safari",
          modificationId: trim.modificationId,
          rawTrim: trim.displayTrim,
          displayTrim: trim.displayTrim,
          submodel: null,
          boltPattern: specs.boltPattern,
          centerBoreMm: specs.centerBoreMm,
          threadSize: specs.threadSize,
          seatType: specs.seatType,
          offsetMinMm: specs.offsetMinMm,
          offsetMaxMm: specs.offsetMaxMm,
          oemWheelSizes: specs.oemWheelSizes,
          oemTireSizes: specs.oemTireSizes,
          source: "manual",
        }).onConflictDoNothing();
        
        inserted++;
        console.log(`  ✓ ${year} GMC Safari ${trim.displayTrim}`);
      } catch (err: any) {
        if (err.code === "23505") {
          skipped++;
          console.log(`  - ${year} GMC Safari ${trim.displayTrim} (already exists)`);
        } else {
          throw err;
        }
      }
    }
  }
  
  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);
  
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
