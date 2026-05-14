import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Test what the resolver would query
const year = 2024;
const make = 'BMW';
const model = 'm3';  // lowercased like getModelVariants does
const trim = 'M3 CS';

console.log('Testing query patterns...\n');

// Query 1: ilike for make and model, exact for trim
const q1 = await sql`
  SELECT id, year, make, model, display_trim, certification_status
  FROM vehicle_fitments
  WHERE year = ${year}
    AND make ILIKE ${make}
    AND model ILIKE ${model}
    AND display_trim = ${trim}
    AND certification_status = 'certified'
`;
console.log(`Query 1 (ilike make/model, exact trim): ${q1.length} results`);
for (const r of q1) {
  console.log(`  ${r.year} ${r.make} ${r.model} "${r.display_trim}" (${r.certification_status})`);
}

// Query 2: Check what the model is stored as
const q2 = await sql`
  SELECT DISTINCT model FROM vehicle_fitments WHERE make ILIKE 'BMW' AND model ILIKE '%M3%'
`;
console.log(`\nDistinct BMW models with "M3": ${q2.map(r => `"${r.model}"`).join(', ')}`);

// Query 3: All 2024 BMW M3 records
const q3 = await sql`
  SELECT id, year, make, model, display_trim, certification_status
  FROM vehicle_fitments
  WHERE year = 2024 AND make ILIKE 'BMW' AND model ILIKE 'M3'
`;
console.log(`\nAll 2024 BMW M3 records (${q3.length}):`);
for (const r of q3) {
  console.log(`  ${r.year} ${r.make} "${r.model}" "${r.display_trim}" (${r.certification_status})`);
}

await sql.end();
