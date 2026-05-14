import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`
  SELECT year, display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE make ILIKE '%mercedes%' AND model ILIKE '%e%class%' AND year = 2024
  ORDER BY display_trim
`;

console.log('2024 Mercedes E-Class trims:');
for (const r of rows) {
  console.log(`  "${r.display_trim}": ${JSON.stringify(r.oem_tire_sizes)}`);
}

if (rows.length === 0) {
  console.log('  (none found)');
}

await sql.end();
