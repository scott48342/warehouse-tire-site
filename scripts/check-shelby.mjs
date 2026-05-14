import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`
  SELECT year, display_trim, oem_tire_sizes, quality_tier 
  FROM vehicle_fitments 
  WHERE make='Ford' AND model='Mustang' 
    AND display_trim ILIKE '%shelby%'
  ORDER BY year DESC, display_trim
`;

console.log('Shelby trims in DB:');
for (const r of rows) {
  console.log(`${r.year} ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)} (tier: ${r.quality_tier})`);
}

if (rows.length === 0) {
  console.log('(none found)');
}

await sql.end();
