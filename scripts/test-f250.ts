import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { listFitments, getFitment } from "../src/lib/fitment-db/getFitment";
import { hasYearCoverage, getTrimsWithCoverage } from "../src/lib/fitment-db/coverage";

async function main() {
  console.log("Testing 2015 Ford F-250 XLT resolution:\n");
  
  // Test with different cases
  console.log("1. listFitments(2015, 'Ford', 'F-250'):");
  const r1 = await listFitments(2015, "Ford", "F-250");
  console.log("   Results:", r1.fitments.length);
  if (r1.fitments.length > 0) {
    console.log("   First:", r1.fitments[0].displayTrim);
  }
  
  console.log("\n2. listFitments(2015, 'ford', 'f-250'):");
  const r2 = await listFitments(2015, "ford", "f-250");
  console.log("   Results:", r2.fitments.length);
  
  console.log("\n3. hasYearCoverage(2015, 'Ford', 'F-250'):");
  const has = await hasYearCoverage(2015, "Ford", "F-250");
  console.log("   Result:", has);
  
  console.log("\n4. getTrimsWithCoverage(2015, 'Ford', 'F-250'):");
  const trims = await getTrimsWithCoverage(2015, "Ford", "F-250");
  console.log("   Has coverage:", trims.hasCoverage);
  console.log("   Trims:", trims.trims.map(t => t.displayTrim));
  
  // Test with XLT modification ID
  console.log("\n5. getFitment with XLT modificationId:");
  const xlt = await getFitment(2015, "Ford", "F-250", "XLT");
  console.log("   Found:", xlt.fitment ? "YES" : "NO");
  if (xlt.fitment) {
    console.log("   Bolt:", xlt.fitment.boltPattern);
  }
  
  // Check what modification IDs exist
  console.log("\n6. Checking actual modification IDs for F-250-Super-Duty:");
  const { db } = await import("../src/lib/fitment-db/db");
  const { sql } = await import("drizzle-orm");
  
  const mods = await db.execute(sql`
    SELECT modification_id, display_trim FROM vehicle_fitments
    WHERE year = 2015 AND make = 'ford' AND model = 'f-250-super-duty'
  `);
  console.log("   Modification IDs:", (mods.rows as any[]).map(r => `${r.modification_id} (${r.display_trim})`));
  
  process.exit(0);
}

main().catch(console.error);
