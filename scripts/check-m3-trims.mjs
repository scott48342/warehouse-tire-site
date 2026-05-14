import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`SELECT year, display_trim, raw_trim, modification_id, oem_tire_sizes FROM vehicle_fitments WHERE make='BMW' AND model='M3' AND year=2024`;
console.log('2024 BMW M3 all trims:');
for (const r of rows) {
  const hasTires = r.oem_tire_sizes?.front || (Array.isArray(r.oem_tire_sizes) && r.oem_tire_sizes.length > 0);
  console.log(`display_trim: "${r.display_trim}"`);
  console.log(`  raw_trim: "${r.raw_trim}"`);
  console.log(`  modification_id: "${r.modification_id}"`);
  console.log(`  has_tire_sizes: ${hasTires}`);
  console.log(`  tire_sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
  console.log('');
}

await sql.end();
