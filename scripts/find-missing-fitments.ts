import { db } from '../src/lib/db';
import { vehicleFitments } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

async function findMissing() {
  const makes = ['Subaru', 'Cadillac', 'Nissan', 'Volkswagen', 'Mercedes-Benz', 'GMC', 'INFINITI', 'MINI', 'Lincoln'];
  
  const allMissing: any[] = [];
  
  for (const make of makes) {
    const missing = await db.select({
      id: vehicleFitments.id,
      year: vehicleFitments.year,
      make: vehicleFitments.make,
      model: vehicleFitments.model,
      trim: vehicleFitments.trim,
      frontTireSize: vehicleFitments.frontTireSize,
      frontWheelDiameter: vehicleFitments.frontWheelDiameter
    })
    .from(vehicleFitments)
    .where(
      sql`(make ILIKE ${make} OR make ILIKE ${'%' + make + '%'})
        AND (front_tire_size IS NULL OR front_tire_size = '')`
    )
    .limit(100);
    
    if (missing.length > 0) {
      console.log(`\n=== ${make} (${missing.length} missing) ===`);
      missing.forEach(r => {
        console.log(`  ${r.id}: ${r.year} ${r.make} ${r.model} ${r.trim || 'Base'}`);
        allMissing.push(r);
      });
    }
  }
  
  console.log(`\n\nTOTAL MISSING: ${allMissing.length}`);
  return allMissing;
}

findMissing().then(() => process.exit(0));
