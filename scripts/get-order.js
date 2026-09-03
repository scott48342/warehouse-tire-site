const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const order = await p.orders.findFirst({
    where: { order_number: 'WTD-83UAXU' },
    include: { order_items: true }
  });
  console.log(JSON.stringify(order, null, 2));
}

main().finally(() => p.$disconnect());
