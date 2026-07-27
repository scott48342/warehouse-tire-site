/**
 * BUICK REGAL TRIM CLEANUP
 * 
 * Problem: Modern trims (Sportback, TourX) were incorrectly applied to ALL years
 * Reality: These trims only exist for 2018+ (6th generation Regal)
 * 
 * Run with: npx tsx scripts/cleanup-regal-trims.ts
 * Add --dry-run to preview without deleting
 */

// Load env vars BEFORE any other imports
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, lt, inArray, asc, ilike } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const MODERN_ONLY_TRIMS = ["Sportback", "TourX"]; // These didn't exist before 2018

// Create local connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  console.log("🔍 BUICK REGAL TRIM CLEANUP");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "⚠️ LIVE - will delete records"}`);
  console.log("");

  // Find affected records (case-insensitive on make/model since DB has mixed case)
  const affected = await db
    .select({
      year: vehicleFitments.year,
      make: vehicleFitments.make,
      model: vehicleFitments.model,
      displayTrim: vehicleFitments.displayTrim,
      modificationId: vehicleFitments.modificationId,
      boltPattern: vehicleFitments.boltPattern,
      offsetMinMm: vehicleFitments.offsetMinMm,
      offsetMaxMm: vehicleFitments.offsetMaxMm,
    })
    .from(vehicleFitments)
    .where(
      and(
        ilike(vehicleFitments.make, "buick"),
        // Match only "regal" (base model), not "Regal Sportback" or "Regal TourX"
        eq(vehicleFitments.model, "regal"),
        lt(vehicleFitments.year, 2018),
        inArray(vehicleFitments.displayTrim, MODERN_ONLY_TRIMS)
      )
    )
    .orderBy(asc(vehicleFitments.year), asc(vehicleFitments.displayTrim));

  console.log(`Found ${affected.length} records to clean up:\n`);
  
  // Group by year for readability
  const byYear = new Map<number, typeof affected>();
  for (const rec of affected) {
    const yearRecords = byYear.get(rec.year) || [];
    yearRecords.push(rec);
    byYear.set(rec.year, yearRecords);
  }
  
  for (const [year, records] of Array.from(byYear.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`Year ${year}:`);
    for (const rec of records) {
      console.log(`  - ${rec.displayTrim} (${rec.model}) [${rec.boltPattern || "no bolt"}, offset: ${rec.offsetMinMm ?? "?"}-${rec.offsetMaxMm ?? "?"}]`);
    }
  }
  
  if (affected.length === 0) {
    console.log("\n✅ No records to clean up - database is already correct!");
    await pool.end();
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log("\n🔸 DRY RUN - no changes made. Run without --dry-run to delete these records.");
    await pool.end();
    process.exit(0);
  }

  // Delete the bad records
  console.log("\n🗑️ Deleting affected records...");
  
  await db
    .delete(vehicleFitments)
    .where(
      and(
        ilike(vehicleFitments.make, "buick"),
        eq(vehicleFitments.model, "regal"),
        lt(vehicleFitments.year, 2018),
        inArray(vehicleFitments.displayTrim, MODERN_ONLY_TRIMS)
      )
    );

  console.log(`\n✅ Deleted ${affected.length} incorrectly-dated Buick Regal records`);
  
  // Also check for GS in years < 2011 (GS wasn't a Regal trim until 5th gen)
  const badGS = await db
    .select({
      year: vehicleFitments.year,
      displayTrim: vehicleFitments.displayTrim,
      modificationId: vehicleFitments.modificationId,
    })
    .from(vehicleFitments)
    .where(
      and(
        ilike(vehicleFitments.make, "buick"),
        eq(vehicleFitments.model, "regal"),
        lt(vehicleFitments.year, 2011),
        eq(vehicleFitments.displayTrim, "GS")
      )
    )
    .orderBy(asc(vehicleFitments.year));

  if (badGS.length > 0) {
    console.log(`\n⚠️ Found ${badGS.length} GS records in years < 2011 (GS wasn't available until 5th gen 2011):`);
    for (const rec of badGS) {
      console.log(`  - ${rec.year} GS (${rec.modificationId})`);
    }
    console.log("\nThese should also be reviewed/deleted separately.");
  }

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Error:", err);
  await pool.end();
  process.exit(1);
});
