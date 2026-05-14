import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { eq, and, ilike } from "drizzle-orm";

async function main() {
  // BMW M3
  const m3 = await db.select({
    displayTrim: vehicleFitments.displayTrim,
    modificationId: vehicleFitments.modificationId,
    oemTireSizes: vehicleFitments.oemTireSizes,
    boltPattern: vehicleFitments.boltPattern,
  }).from(vehicleFitments)
    .where(and(
      eq(vehicleFitments.year, 2024),
      ilike(vehicleFitments.make, 'BMW'),
      ilike(vehicleFitments.model, 'M3'),
      eq(vehicleFitments.certificationStatus, 'certified')
    ));
  
  console.log('=== BMW M3 (2024) ===');
  m3.forEach(r => console.log(JSON.stringify(r, null, 2)));
  
  // BMW M4
  const m4 = await db.select({
    displayTrim: vehicleFitments.displayTrim,
    modificationId: vehicleFitments.modificationId,
    oemTireSizes: vehicleFitments.oemTireSizes,
    boltPattern: vehicleFitments.boltPattern,
  }).from(vehicleFitments)
    .where(and(
      eq(vehicleFitments.year, 2024),
      ilike(vehicleFitments.make, 'BMW'),
      ilike(vehicleFitments.model, 'M4'),
      eq(vehicleFitments.certificationStatus, 'certified')
    ));
  
  console.log('\n=== BMW M4 (2024) ===');
  m4.forEach(r => console.log(JSON.stringify(r, null, 2)));
  
  // Check if all M3 trims have same tire sizes
  console.log('\n=== TIRE SIZE COMPARISON ===');
  const m3Sizes = m3.map(r => JSON.stringify(r.oemTireSizes?.sort()));
  const m4Sizes = m4.map(r => JSON.stringify(r.oemTireSizes?.sort()));
  
  console.log('M3 unique tire size sets:', [...new Set(m3Sizes)].length);
  console.log('M4 unique tire size sets:', [...new Set(m4Sizes)].length);
  
  if ([...new Set(m3Sizes)].length === 1) {
    console.log('✅ All M3 trims have IDENTICAL tire sizes - safe fallback possible');
  } else {
    console.log('❌ M3 trims have DIFFERENT tire sizes - fallback NOT safe');
  }
  
  if ([...new Set(m4Sizes)].length === 1) {
    console.log('✅ All M4 trims have IDENTICAL tire sizes - safe fallback possible');
  } else {
    console.log('❌ M4 trims have DIFFERENT tire sizes - fallback NOT safe');
  }
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
