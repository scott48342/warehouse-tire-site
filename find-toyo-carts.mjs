import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function findToyoCarts() {
  const carts = await prisma.cart.findMany({
    where: {
      updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    },
    orderBy: { updatedAt: 'desc' },
    take: 100
  });
  
  console.log(`Checking ${carts.length} recent carts...`);
  
  for (const cart of carts) {
    try {
      const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
      if (!items || !Array.isArray(items)) continue;
      
      const toyoItems = items.filter(i => 
        i.brand?.toLowerCase() === 'toyo' || 
        i.model?.toLowerCase().includes('toyo') ||
        i.sku === '358060'
      );
      
      if (toyoItems.length > 0) {
        console.log('\n=== Cart Found ===');
        console.log('Cart ID:', cart.id);
        console.log('Updated:', cart.updatedAt);
        console.log('Email:', cart.email || 'none');
        console.log('Toyo items:');
        for (const item of toyoItems) {
          console.log(`  - ${item.brand} ${item.model} (SKU: ${item.sku})`);
          console.log(`    Size: ${item.size}, Qty: ${item.quantity}, Price: $${item.unitPrice}`);
        }
      }
    } catch (e) {
      // skip malformed carts
    }
  }
  
  await prisma.$disconnect();
}

findToyoCarts().catch(console.error);
