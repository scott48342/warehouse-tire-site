/**
 * Test direct DB query for 1984 Buick Regal offset values
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, ilike } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  // Direct query for 1984 Buick Regal
  const [record] = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 1984),
        ilike(vehicleFitments.make, "buick"),
        ilike(vehicleFitments.model, "regal"),
        eq(vehicleFitments.modificationId, "buick-regal-base-cad95b2f")
      )
    )
    .limit(1);

  if (!record) {
    console.log("❌ No record found!");
    await pool.end();
    return;
  }

  console.log("✅ Record found:");
  console.log("  modificationId:", record.modificationId);
  console.log("  displayTrim:", record.displayTrim);
  console.log("  boltPattern:", record.boltPattern);
  console.log("  centerBoreMm:", record.centerBoreMm, `(type: ${typeof record.centerBoreMm})`);
  console.log("  offsetMinMm:", record.offsetMinMm, `(type: ${typeof record.offsetMinMm})`);
  console.log("  offsetMaxMm:", record.offsetMaxMm, `(type: ${typeof record.offsetMaxMm})`);
  console.log("  oemWheelSizes:", JSON.stringify(record.oemWheelSizes));
  console.log("  certificationStatus:", record.certificationStatus);

  // Test the truthiness issue
  console.log("\n🧪 Truthiness test:");
  console.log("  record.offsetMinMm ? 'truthy' : 'falsy':", record.offsetMinMm ? "truthy" : "falsy");
  console.log("  record.offsetMinMm != null:", record.offsetMinMm != null);
  console.log("  Number(record.offsetMinMm):", Number(record.offsetMinMm));

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
