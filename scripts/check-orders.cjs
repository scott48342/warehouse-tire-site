const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      stripeSessionId: true,
      status: true,
      total: true,
      createdAt: true,
      customerEmail: true
    }
  });
  console.log(JSON.stringify(orders, null, 2));
}

main().finally(() => prisma.$disconnect());
