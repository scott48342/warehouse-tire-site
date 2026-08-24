import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const quotes = await db.saved_quotes.findMany({
    where: { user_email: 'test-isolation@warehousetire.net' },
    orderBy: { created_at: 'desc' },
    take: 1,
  });
  
  const q = quotes[0];
  console.log('Quote ID:', q.quote_id);
  console.log('Created:', q.created_at);
  console.log('Total:', q.total_at_save);
  console.log('Subtotal:', q.subtotal_at_save);
  console.log('Tax:', q.tax_at_save);
  
  console.log('\nSnapshot Items:');
  const snap = q.pricing_snapshot as any;
  for (const item of snap.items) {
    console.log('  -', item.brand, item.model, item.size);
    console.log('    unitPrice:', item.unitPrice);
    console.log('    qty:', item.quantity);
    console.log('    lineTotal:', item.unitPrice * item.quantity);
  }
  
  console.log('\nSnapshot Totals:');
  console.log('  partsSubtotal:', snap.pricing.partsSubtotal);
  console.log('  estimatedTax:', snap.pricing.estimatedTax);
  console.log('  total:', snap.pricing.total);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => { console.error(e); db.$disconnect(); });
