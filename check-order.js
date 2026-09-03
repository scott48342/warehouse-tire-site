const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const order = await p.order.findFirst({
    where: { orderNumber: 'WTD-83UAXU' },
    include: { supplierOrders: true, items: true }
  });
  console.log(JSON.stringify(order, null, 2));
  await p.$disconnect();
})();
