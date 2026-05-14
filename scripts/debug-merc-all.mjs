import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Check ALL Mercedes E-Class records regardless of model spelling
const rows = await sql`
  SELECT model, display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE year = 2024
    AND make ILIKE '%mercedes%'
    AND (model ILIKE '%e-class%' OR model ILIKE '%e class%')
    AND certification_status = 'certified'
  ORDER BY model, display_trim
`;

console.log(`Found ${rows.length} total E-Class records:`);
for (const r of rows) {
  console.log(`  model="${r.model}" trim="${r.display_trim}" sizes=${JSON.stringify(r.oem_tire_sizes)}`);
}

await sql.end();
