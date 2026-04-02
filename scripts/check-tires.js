const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const total = await prisma.vehicle_fitments.count();
  const missingTires = await prisma.vehicle_fitments.count({
    where: { oem_tire_sizes: { equals: [] } }
  });
  const nullTires = await prisma.vehicle_fitments.count({
    where: { oem_tire_sizes: null }
  });
  
  console.log('Total records:', total);
  console.log('Empty tire sizes:', missingTires);
  console.log('Null tire sizes:', nullTires);
  console.log('Coverage:', ((total - missingTires - nullTires) / total * 100).toFixed(1) + '%');
  
  await prisma.$disconnect();
}
check();
