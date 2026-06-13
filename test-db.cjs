const { db } = require('./src/lib/fitment-db/client');
const { vehicleFitments } = require('./src/lib/fitment-db/schema');
const { ilike, and } = require('drizzle-orm');

async function main() {
  const results = await db
    .select({
      year: vehicleFitments.year,
      make: vehicleFitments.make,
      model: vehicleFitments.model,
      displayTrim: vehicleFitments.displayTrim,
      boltPattern: vehicleFitments.boltPattern,
      modificationId: vehicleFitments.modificationId
    })
    .from(vehicleFitments)
    .where(and(
      ilike(vehicleFitments.make, '%Chevrolet%'),
      ilike(vehicleFitments.model, '%2500%')
    ))
    .limit(20);
  console.log(JSON.stringify(results, null, 2));
}
main().catch(console.error);
