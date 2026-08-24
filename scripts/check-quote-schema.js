const postgres = require('postgres');

const client = postgres(process.env.POSTGRES_URL);

async function main() {
  const cols = await client`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'saved_quotes' 
    ORDER BY ordinal_position
  `;
  console.log('Columns in saved_quotes:');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  
  // Get latest quote (by most recent created_at)
  const quotes = await client`
    SELECT * FROM saved_quotes 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  if (quotes.length > 0) {
    const q = quotes[0];
    console.log('\n--- Latest Quote ---');
    console.log('ID:', q.id);
    console.log('Created:', q.created_at);
    console.log('Subtotal:', q.subtotal_at_save);
    console.log('Tax:', q.tax_at_save);
    console.log('Total:', q.total_at_save);
    
    if (q.snapshot_json) {
      const snap = q.snapshot_json;
      console.log('\nSnapshot Items:');
      for (const item of snap.items) {
        console.log(`  - ${item.brand} ${item.model} ${item.size}`);
        console.log(`    unitPrice: ${item.unitPrice}`);
        console.log(`    qty: ${item.quantity}`);
        console.log(`    lineTotal: ${item.unitPrice * item.quantity}`);
      }
      console.log('\nSnapshot Totals:');
      console.log('  partsSubtotal:', snap.pricing.partsSubtotal);
      console.log('  estimatedTax:', snap.pricing.estimatedTax);
      console.log('  total:', snap.pricing.total);
    }
  }
  
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
