/**
 * Check complete 1984 Regal record
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
        ilike(vehicleFitments.model, "regal"),
        eq(vehicleFitments.year, 1984)
      )
    );

  console.log(`Found ${records.length} records:\n`);
  
  for (const rec of records) {
    console.log("Full record:");
    console.log(JSON.stringify(rec, null, 2));
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
