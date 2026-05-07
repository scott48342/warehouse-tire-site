const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  // Get our 2018 fitments
  const our2018 = await prisma.vehicle_fitments.findMany({
    where: { year: 2018 },
    select: {
      year: true,
      make: true,
      model: true,
      trim: true,
      bolt_pattern: true,
      hub_bore: true,
      offset_min: true,
      offset_max: true,
      tire_size_front: true,
      tire_size_rear: true,
      thread_size: true
    }
  });
  
  console.log(JSON.stringify({ count: our2018.length, data: our2018 }));
}

main().catch(console.error).finally(() => prisma.$disconnect());
