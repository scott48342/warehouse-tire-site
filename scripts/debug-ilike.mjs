import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Test PostgreSQL ILIKE behavior
console.log('=== Testing ILIKE behavior ===\n');

const test1 = await sql`
  SELECT DISTINCT model FROM vehicle_fitments
  WHERE model ILIKE 'e-class'
`;
console.log(`model ILIKE 'e-class' matches:`, test1.map(r => `"${r.model}"`).join(', '));

const test2 = await sql`
  SELECT DISTINCT model FROM vehicle_fitments
  WHERE model ILIKE 'E-Class'
`;
console.log(`model ILIKE 'E-Class' matches:`, test2.map(r => `"${r.model}"`).join(', '));

const test3 = await sql`
  SELECT DISTINCT model FROM vehicle_fitments
  WHERE make ILIKE 'mercedes-benz'
    AND model ILIKE 'e-class'
`;
console.log(`make ILIKE 'mercedes-benz' AND model ILIKE 'e-class':`, test3.map(r => `"${r.model}"`).join(', '));

// Now check the exact tire-sizes query
console.log('\n=== Simulating resolver query ===\n');

const allRecords = await sql`
  SELECT display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE year = 2024
    AND make ILIKE 'mercedes-benz'
    AND model ILIKE 'e-class'
    AND certification_status = 'certified'
`;

console.log(`Found ${allRecords.length} records:`);
for (const r of allRecords) {
  console.log(`  "${r.display_trim}"`);
}

await sql.end();
