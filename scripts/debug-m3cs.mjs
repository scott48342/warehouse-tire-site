import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`
  SELECT year, display_trim, certification_status, quality_tier, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE make='BMW' AND model='M3' AND year=2024
  ORDER BY display_trim
`;

console.log('2024 BMW M3 - all fields:');
for (const r of rows) {
  console.log(`${r.display_trim}:`);
  console.log(`  certification_status: ${r.certification_status}`);
  console.log(`  quality_tier: ${r.quality_tier}`);
  console.log(`  oem_tire_sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
  console.log('');
}

await sql.end();
