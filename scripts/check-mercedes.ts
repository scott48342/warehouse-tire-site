import { db, schema } from "./src/lib/fitment-db/db";
import { eq, and, like, sql } from "drizzle-orm";

async function check() {
  // Check what Mercedes records exist
  const mercedes = await db
    .select({ 
      make: schema.vehicleFitments.make,
      model: schema.vehicleFitments.model,
      year: schema.vehicleFitments.year,
      count: sql<number>`count(*)`
    })
    .from(schema.vehicleFitments)
    .where(like(schema.vehicleFitments.make, "%mercedes%"))
    .groupBy(schema.vehicleFitments.make, schema.vehicleFitments.model, schema.vehicleFitments.year)
    .limit(10);
  
  console.log("Mercedes records in DB:");
  for (const r of mercedes) {
    console.log(`  ${r.year} ${r.make} ${r.model}: ${r.count} records`);
  }
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
