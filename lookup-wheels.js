const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function lookup() {
  const skus = ['KM54479080618', 'FC892BX17856800', 'MO97821068524NRC', 'MO97021067324N'];
  
  const wheels = await prisma.wheel.findMany({
    where: { sku: { in: skus } },
    select: { sku: true, name: true, brand: true, finish: true, diameter: true, width: true, imageUrl: true }
  });
  
  console.log(JSON.stringify(wheels, null, 2));
  await prisma.$disconnect();
}

lookup();
