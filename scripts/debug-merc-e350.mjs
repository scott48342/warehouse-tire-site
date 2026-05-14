import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Test the exact queries the resolver would make
const year = 2024;
const make = 'Mercedes-Benz';
const model = 'E-Class';
const requestedTrim = 'E350';

console.log('=== Query 1: Model variants ===');
const modelVariants = ['e-class', 'e class', 'e-class-amg'];
for (const modelName of modelVariants) {
  const count = await sql`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE year = ${year}
      AND make ILIKE ${make}
      AND model ILIKE ${modelName}
      AND certification_status = 'certified'
  `;
  console.log(`  model="${modelName}": ${count[0].cnt} records`);
}

console.log('\n=== Query 2: Exact trim match ===');
const exactMatch = await sql`
  SELECT id, display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE year = ${year}
    AND make ILIKE ${make}
    AND model ILIKE 'e-class'
    AND display_trim = ${requestedTrim}
    AND certification_status = 'certified'
  LIMIT 5
`;
console.log(`Exact match for "${requestedTrim}":`, exactMatch.length > 0 ? 'FOUND' : 'NOT FOUND');
for (const r of exactMatch) {
  console.log(`  "${r.display_trim}": ${JSON.stringify(r.oem_tire_sizes)}`);
}

console.log('\n=== Query 3: All E-Class trims (case-insensitive) ===');
const allTrims = await sql`
  SELECT display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE year = ${year}
    AND make ILIKE ${make}
    AND model ILIKE 'e-class'
    AND certification_status = 'certified'
  ORDER BY display_trim
`;
console.log(`Found ${allTrims.length} trims`);
for (const r of allTrims) {
  const normalizedTrim = r.display_trim.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const matchesNormalized = normalizedTrim === 'e350';
  console.log(`  "${r.display_trim}" (normalized: "${normalizedTrim}")${matchesNormalized ? ' ← MATCHES!' : ''}`);
}

await sql.end();
