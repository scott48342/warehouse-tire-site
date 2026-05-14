import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`SELECT year, display_trim, oem_tire_sizes FROM vehicle_fitments WHERE make='BMW' AND model='M3' AND display_trim ILIKE '%CS%' ORDER BY year DESC`;
console.log('BMW M3 CS records:');
for (const r of rows) {
  console.log(`${r.year} ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)}`);
}

await sql.end();
