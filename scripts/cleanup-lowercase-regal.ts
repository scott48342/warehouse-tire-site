/**
 * Clean up lowercase "regal" records that are duplicates/bad data
 * The correct records are "Regal" (capitalized)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, sql } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  console.log("🔍 CLEANUP LOWERCASE 'regal' RECORDS");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "⚠️ LIVE"}`);
  console.log("");

  // Find lowercase regal records
  const affected = await db
    .select({
      year: vehicleFitments.year,
      make: vehicleFitments.make,
      model: vehicleFitments.model,
      displayTrim: vehicleFitments.displayTrim,
      modificationId: vehicleFitments.modificationId,
      offsetMinMm: vehicleFitments.offsetMinMm,
      offsetMaxMm: vehicleFitments.offsetMaxMm,
    })
    .from(vehicleFitments)
    .where(
      and(
        sql`lower(${vehicleFitments.make}) = 'buick'`,
        eq(vehicleFitments.model, "regal")  // exact match lowercase
      )
    )
    .orderBy(vehicleFitments.year);

  console.log(`Found ${affected.length} lowercase 'regal' records:\n`);
  
  // Group by year for display
  const byYear = new Map<number, typeof affected>();
  for (const rec of affected) {
    const yearRecords = byYear.get(rec.year) || [];
    yearRecords.push(rec);
    byYear.set(rec.year, yearRecords);
  }
  
  for (const [year, records] of Array.from(byYear.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`Year ${year}:`);
    for (const rec of records) {
      console.log(`  - ${rec.displayTrim} [offset: ${rec.offsetMinMm ?? "?"}-${rec.offsetMaxMm ?? "?"}]`);
    }
  }
  
  if (affected.length === 0) {
    console.log("\n✅ No lowercase records to clean up!");
    await pool.end();
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log("\n🔸 DRY RUN - no changes made. Run without --dry-run to delete.");
    await pool.end();
    process.exit(0);
  }

  console.log("\n🗑️ Deleting...");
  
  await db
    .delete(vehicleFitments)
    .where(
      and(
        sql`lower(${vehicleFitments.make}) = 'buick'`,
        eq(vehicleFitments.model, "regal")
      )
    );

  console.log(`\n✅ Deleted ${affected.length} lowercase 'regal' records`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
