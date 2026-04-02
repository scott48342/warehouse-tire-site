import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql, inArray, eq, and } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

async function main() {
  // Test the inArray query directly
  const modelVariants = ["f-350", "f-350-super-duty"];
  console.log("Testing query with model variants:", modelVariants);
  
  try {
    const result = await db
      .selectDistinct({ year: vehicleFitments.year, model: vehicleFitments.model })
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.make, "ford"),
          inArray(vehicleFitments.model, modelVariants)
        )
      )
      .limit(10);
    
    console.log("Drizzle Result:", result);
  } catch (e) {
    console.log("Drizzle Error:", e);
  }
  
  // Also test direct SQL
  const direct = await db.execute(sql`
    SELECT DISTINCT year, model FROM vehicle_fitments
    WHERE make = 'ford' AND model IN ('f-350', 'f-350-super-duty')
    ORDER BY year DESC LIMIT 10
  `);
  console.log("Direct SQL:", direct.rows);
  
  process.exit(0);
}

main().catch(console.error);
