/**
 * Delete grouped Regal records with modern trims in old years
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, lt, ilike, like, or } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  console.log("🔍 CLEANUP GROUPED REGAL RECORDS WITH MODERN TRIMS");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "⚠️ LIVE"}`);
  console.log("");

  // Find grouped records that contain modern trims (Sportback, TourX) in pre-2018 years
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
        ilike(vehicleFitments.model, "%regal%"),
        lt(vehicleFitments.year, 2018),
        or(
          like(vehicleFitments.displayTrim, "%Sportback%"),
          like(vehicleFitments.displayTrim, "%TourX%")
        )
      )
    );

  console.log(`Found ${affected.length} grouped records to clean up:\n`);
  
  for (const rec of affected) {
    console.log(`  - ${rec.year} ${rec.model}: "${rec.displayTrim}" (${rec.modificationId})`);
  }
  
  if (affected.length === 0) {
    console.log("\n✅ No records to clean up!");
    await pool.end();
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log("\n🔸 DRY RUN - no changes made.");
    await pool.end();
    process.exit(0);
  }

  // Delete records
  console.log("\n🗑️ Deleting...");
  
  await db
    .delete(vehicleFitments)
    .where(
      and(
        ilike(vehicleFitments.make, "buick"),
        ilike(vehicleFitments.model, "%regal%"),
        lt(vehicleFitments.year, 2018),
        or(
          like(vehicleFitments.displayTrim, "%Sportback%"),
          like(vehicleFitments.displayTrim, "%TourX%")
        )
      )
    );

  console.log(`\n✅ Deleted ${affected.length} records`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
