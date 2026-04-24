import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { vehicleFitments } from '../src/lib/fitment-db/schema.js';
import { sql, count, isNull, isNotNull, and, ne } from 'drizzle-orm';

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

async function check() {
  // Count total records
  const [{ cnt: total }] = await db.select({ cnt: count() }).from(vehicleFitments);
  
  // Count records with tire sizes
  const [{ cnt: withTires }] = await db.select({ cnt: count() })
    .from(vehicleFitments)
    .where(and(
      isNotNull(vehicleFitments.frontTireSize),
      ne(vehicleFitments.frontTireSize, '')
    ));
  
  // By source
  const bySrc = await db.execute(sql`
    SELECT source, COUNT(*)::int as cnt, 
           SUM(CASE WHEN front_tire_size IS NOT NULL AND front_tire_size != '' THEN 1 ELSE 0 END)::int as with_tires
    FROM vehicle_fitments 
    GROUP BY source 
    ORDER BY cnt DESC
  `);
  
  // Sample without tire sizes
  const noTires = await db.execute(sql`
    SELECT year, make, model, display_trim, bolt_pattern
    FROM vehicle_fitments 
    WHERE front_tire_size IS NULL OR front_tire_size = ''
    ORDER BY year DESC, make, model
    LIMIT 20
  `);
  
  console.log('=== TIRE SIZE COVERAGE ===');
  console.log('Total records:', total);
  console.log('With tire sizes:', withTires, `(${Math.round(withTires/total*100)}%)`);
  console.log('Without tire sizes:', total - withTires);
  console.log('\n=== BY SOURCE ===');
  bySrc.forEach(r => console.log(`  ${r.source}: ${r.cnt} records, ${r.with_tires} with tires (${Math.round(r.with_tires/r.cnt*100)}%)`));
  console.log('\n=== SAMPLE WITHOUT TIRE SIZES ===');
  noTires.forEach(r => {
    console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim || 'Base'} - BP: ${r.bolt_pattern}`);
  });
  
  await client.end();
}

check().catch(e => { console.error(e); process.exit(1); });
