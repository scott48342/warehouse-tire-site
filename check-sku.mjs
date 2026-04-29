import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

const sku = 'FC403PB20905001';

// Check wheel_inventory for this SKU
const inv = await prisma.wheel_inventory.findFirst({
  where: { sku }
});
console.log('Inventory:', inv ? JSON.stringify(inv, null, 2) : 'NOT FOUND');

// Check if FC403 BURN style exists at all
const anyBurn = await prisma.wheel_inventory.findMany({
  where: { sku: { startsWith: 'FC403' } },
  take: 10
});
console.log('\nAny FC403 SKUs:', anyBurn.length ? anyBurn.map(w => w.sku) : 'NONE');

await prisma.$disconnect();
