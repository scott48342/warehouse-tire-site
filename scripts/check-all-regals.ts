/**
 * Check ALL Regal records in the DB
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ilike, sql } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  // Count by model name variant
  const variants = await db
    .select({
      model: vehicleFitments.model,
      count: sql<number>`count(*)`,
      minYear: sql<number>`min(year)`,
      maxYear: sql<number>`max(year)`,
    })
    .from(vehicleFitments)
    .where(ilike(vehicleFitments.model, "%regal%"))
    .groupBy(vehicleFitments.model);

  console.log("Regal model variants in DB:\n");
  for (const v of variants) {
    console.log(`  "${v.model}": ${v.count} records (years ${v.minYear}-${v.maxYear})`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
