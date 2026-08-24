const postgres = require('postgres');

const client = postgres(process.env.POSTGRES_URL);

async function main() {
  const quotes = await client`
    SELECT id, name, vehicle_year, vehicle_make, vehicle_model, snapshot_json, created_at 
    FROM saved_quotes 
    ORDER BY created_at DESC
  `;
  
  console.log('All quotes:');
  quotes.forEach((q, i) => {
    const snap = q.snapshot_json;
    const total = snap?.pricing?.total || 0;
    const items = snap?.items || [];
    const firstItem = items[0] || {};
    console.log(`[${i}] ${q.id} - ${q.vehicle_year} ${q.vehicle_make} ${q.vehicle_model}`);
    console.log(`    Total: $${total}`);
    console.log(`    Item: ${firstItem.brand} ${firstItem.model} ${firstItem.size} @ $${firstItem.unitPrice}`);
    console.log();
  });
  
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
