import { db } from '../src/lib/db';
import { vehicleFitments } from '../src/lib/db/schema';
import { eq, and, ilike } from 'drizzle-orm';

async function check() {
  // 2008 Chrysler 300
  const chrysler = await db.select()
    .from(vehicleFitments)
    .where(and(
      eq(vehicleFitments.year, 2008),
      ilike(vehicleFitments.make, 'chrysler'),
      ilike(vehicleFitments.model, '300')
    ));
  
  console.log('=== 2008 Chrysler 300 ===');
  chrysler.forEach(r => console.log(`${r.trim} | cb: ${r.centerBore} | bolt: ${r.boltPattern}`));

  // 2015 Ford F-250
  const f250 = await db.select()
    .from(vehicleFitments)
    .where(and(
      eq(vehicleFitments.year, 2015),
      ilike(vehicleFitments.make, 'ford'),
      ilike(vehicleFitments.model, 'f-250')
    ));
  
  console.log('\n=== 2015 Ford F-250 ===');
  f250.forEach(r => console.log(`${r.trim} | cb: ${r.centerBore} | bolt: ${r.boltPattern}`));

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
