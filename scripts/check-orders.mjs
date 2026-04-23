import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all orders from the past week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: weekAgo }
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      grandTotal: true,
      createdAt: true,
      customerEmail: true,
      paymentStatus: true
    }
  });
  
  console.log(`\n=== Orders This Week (${orders.length} total) ===\n`);
  
  for (const order of orders) {
    console.log(`${order.orderNumber || order.id.slice(0,8)} | ${order.status?.padEnd(12)} | $${order.grandTotal?.toFixed(2) || 'N/A'} | ${order.paymentStatus?.padEnd(10)} | ${order.createdAt.toISOString().slice(0,16)} | ${order.customerEmail || 'no email'}`);
  }
  
  // Group by status
  const byStatus = {};
  for (const o of orders) {
    byStatus[o.status || 'unknown'] = (byStatus[o.status || 'unknown'] || 0) + 1;
  }
  console.log('\n=== By Status ===');
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`${status}: ${count}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
