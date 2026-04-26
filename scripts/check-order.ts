import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check for orders with this payment intent or quote ID
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { stripePaymentIntentId: 'pi_3TQ7eQC24ptuq90R097hlVJT' },
        { quoteId: 'e722f54321f80fddc738e611bae4fa08' },
        { customerEmail: 'jedibloodline1012@gmail.com' }
      ]
    }
  });
  
  console.log('Orders matching payment/quote/email:', orders.length);
  if (orders.length > 0) {
    console.log(JSON.stringify(orders, null, 2));
  }

  // Check recent orders
  const recent = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { 
      id: true, 
      customerEmail: true, 
      total: true, 
      createdAt: true, 
      stripePaymentIntentId: true,
      customerName: true
    }
  });
  console.log('\nRecent 5 orders:');
  for (const o of recent) {
    console.log(`  ${o.createdAt?.toISOString().slice(0,10)} | ${o.customerName || 'N/A'} | ${o.customerEmail} | $${o.total}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
