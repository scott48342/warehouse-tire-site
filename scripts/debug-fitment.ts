// Debug script to check fitment data - uses project's db setup
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { eq, and, ilike } from "drizzle-orm";

async function main() {
  const year = parseInt(process.argv[2] || "2024", 10);
  const make = process.argv[3] || "Ford";
  const model = process.argv[4] || "Mustang";
  
  console.log(`\n=== Checking fitment data for ${year} ${make} ${model} ===\n`);
  
  const rows = await db
    .select({
      modificationId: vehicleFitments.modificationId,
      displayTrim: vehicleFitments.displayTrim,
      oemTireSizes: vehicleFitments.oemTireSizes,
      certificationStatus: vehicleFitments.certificationStatus,
    })
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, year),
        ilike(vehicleFitments.make, make),
        ilike(vehicleFitments.model, `%${model}%`)
      )
    )
    .limit(20);
  
  console.log(`Found ${rows.length} fitment records:\n`);
  
  for (const row of rows) {
    console.log(`modificationId: "${row.modificationId}"`);
    console.log(`displayTrim:    "${row.displayTrim}"`);
    console.log(`tireSizes:      ${JSON.stringify(row.oemTireSizes)}`);
    console.log(`certification:  ${row.certificationStatus}`);
    console.log('---');
  }
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
