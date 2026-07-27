import { db, schema } from '../src/lib/fitment-db/index.js';
import { eq, inArray, and } from 'drizzle-orm';

const regals = await db
  .select({
    year: schema.vehicleFitments.year,
    displayTrim: schema.vehicleFitments.displayTrim,
    modificationId: schema.vehicleFitments.modificationId,
    offsetRange: schema.vehicleFitments.offsetRange,
    boltPattern: schema.vehicleFitments.boltPattern,
    centerBoreMm: schema.vehicleFitments.centerBoreMm,
  })
  .from(schema.vehicleFitments)
  .where(
    and(
      eq(schema.vehicleFitments.make, 'Buick'),
      eq(schema.vehicleFitments.model, 'Regal'),
      inArray(schema.vehicleFitments.year, [1984, 1985, 2018, 2019])
    )
  );

console.log(JSON.stringify(regals, null, 2));
process.exit(0);
