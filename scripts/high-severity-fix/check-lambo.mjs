import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`
  SELECT display_trim, certification_status, bolt_pattern
  FROM vehicle_fitments
  WHERE year = 2018 AND make = 'Lamborghini'
  ORDER BY model, display_trim
`;

console.log('2018 Lamborghini trims:');
for (const r of rows) {
  console.log(`  "${r.display_trim}" (${r.certification_status}) bolt: ${r.bolt_pattern || 'NULL'}`);
}

await sql.end();
