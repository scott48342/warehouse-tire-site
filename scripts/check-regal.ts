import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const regals = await prisma.vehicle_fitments.findMany({
    where: {
      make: 'Buick',
      model: 'Regal',
      year: { in: [1984, 1985, 2018, 2019] }
    },
    select: {
      year: true,
      display_trim: true,
      modification_id: true,
      offset_range: true,
      bolt_pattern: true,
      center_bore_mm: true,
    },
    orderBy: { year: 'asc' }
  });
  
  console.log(JSON.stringify(regals, null, 2));
}

main().finally(() => prisma.$disconnect());
