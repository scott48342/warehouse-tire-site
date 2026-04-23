import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Count total vehicle_fitments entries
  const total = await prisma.vehicle_fitments.count();
  
  // Get unique combinations
  const uniqueResult = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM (
      SELECT DISTINCT year, make, model FROM vehicle_fitments
    ) as unique_vehicles
  `;
  
  console.log('Total DB entries:', total);
  console.log('Unique year/make/model in DB:', uniqueResult[0].count);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
