import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { desc, eq } from 'drizzle-orm';
import { pgTable, varchar, text, jsonb, decimal, timestamp } from 'drizzle-orm/pg-core';

// Define table schema
const savedQuotes = pgTable('saved_quotes', {
  quote_id: varchar('quote_id', { length: 30 }).primaryKey(),
  user_email: varchar('user_email', { length: 255 }),
  subtotal_at_save: decimal('subtotal_at_save', { precision: 10, scale: 2 }),
  tax_at_save: decimal('tax_at_save', { precision: 10, scale: 2 }),
  total_at_save: decimal('total_at_save', { precision: 10, scale: 2 }),
  pricing_snapshot: jsonb('pricing_snapshot'),
  created_at: timestamp('created_at'),
});

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL not set');
  }
  
  const client = postgres(connectionString);
  const db = drizzle(client);
  
  const quotes = await db.select()
    .from(savedQuotes)
    .where(eq(savedQuotes.user_email, 'test-isolation@warehousetire.net'))
    .orderBy(desc(savedQuotes.created_at))
    .limit(1);
  
  const q = quotes[0];
  console.log('Quote ID:', q.quote_id);
  console.log('Created:', q.created_at);
  console.log('Subtotal:', q.subtotal_at_save);
  console.log('Tax:', q.tax_at_save);
  console.log('Total:', q.total_at_save);
  
  const snap = q.pricing_snapshot as any;
  console.log('\nSnapshot Items:');
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
  
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
