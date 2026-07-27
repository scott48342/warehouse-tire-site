/**
 * BUICK REGAL GS CLEANUP
 * 
 * Problem: GS trim incorrectly applied to years before 2011
 * Reality: GS only existed on 5th gen Regal (2011-2017) and 6th gen (2018-2020)
 * 
 * Run with: npx tsx scripts/cleanup-regal-gs.ts
 * Add --dry-run to preview without deleting
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, lt, asc, ilike } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  console.log("🔍 BUICK REGAL GS CLEANUP");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "⚠️ LIVE - will delete records"}`);
  console.log("");

  // Find GS records in years < 2011
  const affected = await db
    .select({
      year: vehicleFitments.year,
      model: vehicleFitments.model,
      displayTrim: vehicleFitments.displayTrim,
      modificationId: vehicleFitments.modificationId,
      boltPattern: vehicleFitments.boltPattern,
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

  console.log(`Found ${affected.length} GS records to clean up (pre-2011):\n`);
  
  for (const rec of affected) {
    console.log(`  - ${rec.year} ${rec.displayTrim} (${rec.model}) [${rec.boltPattern || "no bolt"}]`);
  }
  
  if (affected.length === 0) {
    console.log("\n✅ No records to clean up!");
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
        lt(vehicleFitments.year, 2011),
        eq(vehicleFitments.displayTrim, "GS")
      )
    );

  console.log(`\n✅ Deleted ${affected.length} incorrectly-dated Buick Regal GS records`);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Error:", err);
  await pool.end();
  process.exit(1);
});
