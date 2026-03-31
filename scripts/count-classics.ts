import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/fitment-db/db";
import { classicFitments } from "../src/lib/classic-fitment/schema";
import { eq, count } from "drizzle-orm";

async function main() {
  const result = await db
    .select({ count: count() })
    .from(classicFitments)
    .where(eq(classicFitments.isActive, true));
  
  console.log("Total active classic_fitments records:", result[0].count);
  
  // Group by platform
  const byPlatform = await db
    .select({
      platformCode: classicFitments.platformCode,
      platformName: classicFitments.platformName,
      count: count(),
    })
    .from(classicFitments)
    .where(eq(classicFitments.isActive, true))
    .groupBy(classicFitments.platformCode, classicFitments.platformName);
  
  console.log("\nBy Platform:");
  for (const p of byPlatform) {
    console.log(`  ${p.platformCode}: ${p.count} records (${p.platformName})`);
  }
  
  process.exit(0);
}

main();
