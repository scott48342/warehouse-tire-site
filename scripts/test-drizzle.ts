import { config } from 'dotenv';
config({ path: '.env.local' });

// Dynamic import AFTER env is loaded
async function main() {
  const { db } = await import('../src/lib/fitment-db/db');
  const { vehicleFitments } = await import('../src/lib/fitment-db/schema');
  const { eq, and, sql } = await import('drizzle-orm');
  console.log('Testing Drizzle ORM query...');

  // Run the same query that profileService uses
  const [fitment] = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 2023),
        sql`lower(${vehicleFitments.make}) = 'dodge'`,
        sql`lower(${vehicleFitments.model}) = 'challenger'`,
        eq(vehicleFitments.modificationId, 'srt-hellcat-widebody'),
        eq(vehicleFitments.certificationStatus, 'certified')
      )
    )
    .limit(1);

  if (fitment) {
    console.log('\n=== DRIZZLE RESULT ===');
    console.log('modificationId:', fitment.modificationId);
    console.log('displayTrim:', fitment.displayTrim);
    console.log('oemWheelSizes type:', typeof fitment.oemWheelSizes);
    console.log('oemWheelSizes isArray:', Array.isArray(fitment.oemWheelSizes));
    console.log('oemWheelSizes length:', (fitment.oemWheelSizes as any[])?.length);
    console.log('oemWheelSizes:', JSON.stringify(fitment.oemWheelSizes, null, 2));
  } else {
    console.log('No fitment found!');
  }

  process.exit(0);
}

main().catch(console.error);
