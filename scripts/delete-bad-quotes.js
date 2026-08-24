const postgres = require('postgres');

const client = postgres(process.env.POSTGRES_URL);

// Bad quote IDs to delete (test data with wrong pricing)
const badQuoteIds = [
  'sq_nWnIglCue2LAL75JCStX8',  // $153.35 wrong commercial
  'sq_d92L5KvXdokxgU9SM_P_U',  // $153.35 wrong commercial
  'sq_4YHdWki9yKprXnda4BjYi',  // $0 zero pricing
  'sq_hAycELgvdUECLr_XbqmV_',  // $0 zero pricing
];

async function main() {
  console.log('Deleting bad test quotes...');
  
  for (const id of badQuoteIds) {
    const result = await client`
      DELETE FROM saved_quotes WHERE id = ${id}
    `;
    console.log(`  Deleted: ${id}`);
  }
  
  console.log('\nRemaining quotes:');
  const remaining = await client`
    SELECT id, vehicle_year, vehicle_make, vehicle_model, snapshot_json
    FROM saved_quotes 
    ORDER BY created_at DESC
  `;
  
  remaining.forEach((q, i) => {
    const snap = q.snapshot_json;
    const total = snap?.pricing?.total || 0;
    const firstItem = snap?.items?.[0] || {};
    console.log(`[${i}] ${q.id} - ${q.vehicle_year} ${q.vehicle_make} ${q.vehicle_model}`);
    console.log(`    Total: $${total}, Unit: $${firstItem.unitPrice}`);
  });
  
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
