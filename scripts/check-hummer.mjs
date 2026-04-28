import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hummers = await prisma.vehicle_fitments.findMany({
    where: { make: 'Hummer', model: 'H2' },
    take: 5
  });
  console.log(JSON.stringify(hummers, null, 2));
}

main().finally(() => prisma.$disconnect());
