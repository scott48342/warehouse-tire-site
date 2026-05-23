import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check supplier order
  const supplierOrder = await prisma.supplier_orders.findFirst({
    where: { supplier_order_number: 'HDS26692934' }
  });
  console.log('Supplier order:', JSON.stringify(supplierOrder, null, 2));
  
  // Also check the main order
  const mainOrder = await prisma.orders.findFirst({
    where: { order_number: 'WTD-T5JT8F' }
  });
  console.log('Main order:', JSON.stringify(mainOrder, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
