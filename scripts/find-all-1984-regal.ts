/**
 * Find ALL 1984 Buick Regal records in the DB
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
  const records = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        ilike(vehicleFitments.make, "buick"),
        ilike(vehicleFitments.model, "%regal%"),
        eq(vehicleFitments.year, 1984)
      )
    );

  console.log(`Found ${records.length} records for 1984 Buick Regal:\n`);
  
  for (const rec of records) {
    console.log(`Model: "${rec.model}"`);
    console.log(`  Trim: ${rec.displayTrim}`);
    console.log(`  Modification ID: ${rec.modificationId}`);
    console.log(`  Bolt Pattern: ${rec.boltPattern}`);
    console.log(`  Offset: ${rec.offsetMinMm}-${rec.offsetMaxMm}`);
    console.log(`  Center Bore: ${rec.centerBoreMm}`);
    console.log(`  Source: ${rec.source}`);
    console.log("");
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
