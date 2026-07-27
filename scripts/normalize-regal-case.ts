/**
 * Normalize lowercase "regal" to "Regal" for consistency
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
  console.log("🔧 NORMALIZE 'regal' → 'Regal'");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "⚠️ LIVE"}`);
  console.log("");

  // Count affected records
  const affected = await db
    .select({ count: sql<number>`count(*)` })
    .from(vehicleFitments)
    .where(eq(vehicleFitments.model, "regal"));

  console.log(`Found ${affected[0].count} records with model = 'regal' (lowercase)`);
  
  if (affected[0].count === 0) {
    console.log("\n✅ No records to normalize!");
    await pool.end();
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log("\n🔸 DRY RUN - no changes made. Run without --dry-run to update.");
    await pool.end();
    process.exit(0);
  }

  console.log("\n📝 Updating...");
  
  await db
    .update(vehicleFitments)
    .set({ model: "Regal" })
    .where(eq(vehicleFitments.model, "regal"));

  console.log(`\n✅ Updated ${affected[0].count} records: 'regal' → 'Regal'`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
