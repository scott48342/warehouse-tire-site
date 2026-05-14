import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";

async function main() {
  // Find all "Base" trim records for BMW M3 and M4
  const fakeBase = await db.select({
    id: vehicleFitments.id,
    year: vehicleFitments.year,
    make: vehicleFitments.make,
    model: vehicleFitments.model,
    displayTrim: vehicleFitments.displayTrim,
    modificationId: vehicleFitments.modificationId,
    oemTireSizes: vehicleFitments.oemTireSizes,
    certificationStatus: vehicleFitments.certificationStatus,
    createdAt: vehicleFitments.createdAt,
  }).from(vehicleFitments)
    .where(and(
      ilike(vehicleFitments.make, 'BMW'),
      or(
        ilike(vehicleFitments.model, 'M3'),
        ilike(vehicleFitments.model, 'M4')
      ),
      ilike(vehicleFitments.displayTrim, '%base%')
    ));
  
  console.log('=== FAKE "Base" RECORDS FOR BMW M3/M4 ===');
  console.log(`Found ${fakeBase.length} records with "Base" in displayTrim\n`);
  
  fakeBase.forEach(r => {
    console.log('---');
    console.log(`ID: ${r.id}`);
    console.log(`Year: ${r.year}`);
    console.log(`Make: ${r.make}`);
    console.log(`Model: ${r.model}`);
    console.log(`displayTrim: ${r.displayTrim}`);
    console.log(`modificationId: ${r.modificationId}`);
    console.log(`oemTireSizes: ${JSON.stringify(r.oemTireSizes)}`);
    console.log(`certificationStatus: ${r.certificationStatus}`);
    console.log(`createdAt: ${r.createdAt}`);
  });
  
  // Also check if modification_id="base" exists
  const baseModId = await db.select({
    id: vehicleFitments.id,
    year: vehicleFitments.year,
    make: vehicleFitments.make,
    model: vehicleFitments.model,
    displayTrim: vehicleFitments.displayTrim,
    modificationId: vehicleFitments.modificationId,
    oemTireSizes: vehicleFitments.oemTireSizes,
    certificationStatus: vehicleFitments.certificationStatus,
  }).from(vehicleFitments)
    .where(and(
      ilike(vehicleFitments.make, 'BMW'),
      or(
        ilike(vehicleFitments.model, 'M3'),
        ilike(vehicleFitments.model, 'M4')
      ),
      eq(vehicleFitments.modificationId, 'base')
    ));
    
  console.log('\n\n=== RECORDS WITH modificationId="base" ===');
  console.log(`Found ${baseModId.length} records\n`);
  
  baseModId.forEach(r => {
    console.log('---');
    console.log(`ID: ${r.id}`);
    console.log(`${r.year} ${r.make} ${r.model} - ${r.displayTrim}`);
    console.log(`modificationId: ${r.modificationId}`);
    console.log(`oemTireSizes: ${JSON.stringify(r.oemTireSizes)}`);
  });
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
