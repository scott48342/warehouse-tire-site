import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const order = await prisma.order.findUnique({
  where: { id: 'WTD-JP8YBD' },
  include: {
    items: true,
    payments: true,
  }
});
console.log(JSON.stringify(order, null, 2));
await prisma.$disconnect();
