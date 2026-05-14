import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`
  SELECT DISTINCT model FROM vehicle_fitments WHERE make ILIKE '%mercedes%' AND model ILIKE '%e%class%'
`;

console.log('Mercedes E-Class model variations:');
for (const r of rows) {
  console.log(`  "${r.model}"`);
}

await sql.end();
