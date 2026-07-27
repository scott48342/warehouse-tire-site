/**
 * Check Buick Regal data in the DB
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, lt, ilike, or, sql } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  // Check what Regal models exist
  const models = await db
    .selectDistinct({
      model: vehicleFitments.model,
    })
    .from(vehicleFitments)
    .where(
      and(
        ilike(vehicleFitments.make, "buick"),
        ilike(vehicleFitments.model, "%regal%")
      )
    );
  
  console.log("Regal model variants in DB:", models.map(m => m.model));
  
  // Check year range for each model
  for (const {model} of models) {
    const years = await db
      .select({
        minYear: sql<number>`min(year)`,
        maxYear: sql<number>`max(year)`,
        count: sql<number>`count(*)`,
      })
      .from(vehicleFitments)
      .where(
        and(
          ilike(vehicleFitments.make, "buick"),
          eq(vehicleFitments.model, model)
        )
      );
    console.log(`\n${model}: years ${years[0].minYear}-${years[0].maxYear}, count: ${years[0].count}`);
    
    // Check trims for pre-2018 years
    const oldTrims = await db
      .selectDistinct({
        displayTrim: vehicleFitments.displayTrim,
      })
      .from(vehicleFitments)
      .where(
        and(
          ilike(vehicleFitments.make, "buick"),
          eq(vehicleFitments.model, model),
          lt(vehicleFitments.year, 2000)
        )
      );
    
    if (oldTrims.length > 0) {
      console.log(`  Pre-2000 trims: ${oldTrims.map(t => t.displayTrim).join(", ")}`);
    }
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
