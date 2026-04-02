import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  const models = await db.execute(sql`
    SELECT DISTINCT make, model, COUNT(DISTINCT year) as years
    FROM vehicle_fitments
    GROUP BY make, model
    ORDER BY make, model
  `);

  console.log("ALL MODELS IN DATABASE:");
  console.log("─────────────────────────────────────────");
  
  let currentMake = "";
  for (const r of models.rows as any[]) {
    if (r.make !== currentMake) {
      console.log(`\n${r.make.toUpperCase()}:`);
      currentMake = r.make;
    }
    console.log(`  ${r.model}: ${r.years} years`);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
