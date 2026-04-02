import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const result = await prisma.vehicleFitment.findMany({
  where: {
    make: { contains: 'GMC', mode: 'insensitive' },
    model: { contains: 'Sierra 2500', mode: 'insensitive' },
    year: 2008
  },
  take: 10
});
console.log('Found:', result.length);
console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
