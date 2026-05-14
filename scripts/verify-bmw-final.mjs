import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

console.log('='.repeat(60));
console.log(' BMW M3/M4 DELETE VERIFICATION - FINAL STATE');
console.log('='.repeat(60));
console.log();

// 1. Check for any remaining "Base" records
const baseRecords = await sql`
  SELECT id, year, model, display_trim, modification_id
  FROM vehicle_fitments 
  WHERE make ILIKE 'BMW' 
    AND (model ILIKE 'M3' OR model ILIKE 'M4')
    AND display_trim = 'Base'
    AND year >= 2021
`;

console.log('1. "Base" records (2021-2026):');
console.log(`   Count: ${baseRecords.length}`);
if (baseRecords.length > 0) {
  console.log('   ⚠️  Still found Base records!');
  for (const r of baseRecords) {
    console.log(`      - ${r.year} ${r.model} (${r.modification_id})`);
  }
} else {
  console.log('   ✅ No fake Base records found');
}
console.log();

// 2. List all remaining trims by year
console.log('2. Remaining trims by year:');
const trims = await sql`
  SELECT year, model, display_trim
  FROM vehicle_fitments 
  WHERE make ILIKE 'BMW' 
    AND (model ILIKE 'M3' OR model ILIKE 'M4')
    AND year >= 2021
  ORDER BY year DESC, model, display_trim
`;

const byYear = {};
for (const r of trims) {
  const key = `${r.year} ${r.model}`;
  if (!byYear[key]) byYear[key] = [];
  byYear[key].push(r.display_trim);
}

console.log();
for (const [ym, trimList] of Object.entries(byYear).sort()) {
  console.log(`   ${ym}: ${trimList.join(', ')}`);
}

// 3. Summary stats
console.log();
console.log('3. Summary:');
console.log(`   Total M3/M4 trims (2021-2026): ${trims.length}`);
console.log(`   M3 trims: ${trims.filter(t => t.model.includes('M3')).length}`);
console.log(`   M4 trims: ${trims.filter(t => t.model.includes('M4')).length}`);

await sql.end();
