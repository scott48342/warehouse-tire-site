import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const orders = await prisma.order.findMany({
  where: { createdAt: { gte: sevenDaysAgo } },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    createdAt: true,
    status: true,
    totalCents: true,
    customerEmail: true,
  }
});

console.log(`\n=== Orders in last 7 days: ${orders.length} ===\n`);
orders.forEach(o => {
  console.log(`${o.createdAt.toISOString().slice(0,10)} | $${(o.totalCents/100).toFixed(2)} | ${o.status} | ${o.customerEmail || 'no email'}`);
});

await prisma.$disconnect();
