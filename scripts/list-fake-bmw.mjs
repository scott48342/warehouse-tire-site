import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

const records = await sql`
  SELECT id, year, model, display_trim, modification_id, source
  FROM vehicle_fitments 
  WHERE make ILIKE 'BMW' 
    AND (model ILIKE 'M3' OR model ILIKE 'M4')
    AND display_trim = 'Base'
    AND (modification_id LIKE 'manual_%' OR modification_id = 'base')
    AND year >= 2021
  ORDER BY year DESC, model
`;

console.log('FAKE BMW M3/M4 "Base" Records (2021-2026):');
console.log(`Count: ${records.length}\n`);

console.log('| ID | Year | Model | Source |');
console.log('|----|------|-------|--------|');
for (const r of records) {
  console.log(`| ${r.id} | ${r.year} | ${r.model} | ${r.source} |`);
}

console.log('\nDELETE STATEMENT (DRY RUN):');
console.log(`DELETE FROM vehicle_fitments WHERE id IN ('${records.map(r => r.id).join("', '")}');`);

await sql.end();
