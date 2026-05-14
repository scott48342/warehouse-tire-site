import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Check DRW trims
const rows = await sql`
  SELECT year, display_trim, oem_tire_sizes, certification_status
  FROM vehicle_fitments
  WHERE make = 'RAM' AND model = '3500'
    AND display_trim LIKE '%Dual Rear Wheel%'
  ORDER BY year, display_trim
  LIMIT 10
`;

console.log('RAM 3500 DRW trims (sample):');
for (const r of rows) {
  console.log(`${r.year} "${r.display_trim}": ${JSON.stringify(r.oem_tire_sizes)} (${r.certification_status})`);
}

// Check if these have SRW counterparts
const srwRows = await sql`
  SELECT year, display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE make = 'RAM' AND model = '3500'
    AND display_trim NOT LIKE '%Dual Rear Wheel%'
    AND certification_status = 'certified'
  ORDER BY year, display_trim
  LIMIT 10
`;

console.log('\nRAM 3500 SRW trims (sample):');
for (const r of srwRows) {
  console.log(`${r.year} "${r.display_trim}": ${JSON.stringify(r.oem_tire_sizes)}`);
}

await sql.end();
