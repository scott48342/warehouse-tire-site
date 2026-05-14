import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`
  SELECT id, year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes, bolt_pattern
  FROM vehicle_fitments
  WHERE make = 'Chevrolet' AND model = 'Camaro' 
    AND display_trim LIKE '%SS 1LE%'
    AND year = 2024
  LIMIT 3
`;

console.log('Sample updated records:');
for (const row of rows) {
  console.log(`\n${row.year} ${row.make} ${row.model} ${row.display_trim}`);
  console.log('  oem_tire_sizes:', JSON.stringify(row.oem_tire_sizes, null, 2));
  console.log('  oem_wheel_sizes:', JSON.stringify(row.oem_wheel_sizes));
  console.log('  bolt_pattern:', row.bolt_pattern);
}

// Also check a Corvette
const corvettes = await sql`
  SELECT id, year, make, model, display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE make = 'Chevrolet' AND model = 'Corvette' 
    AND year = 2024
    AND display_trim LIKE '%Stingray%'
  LIMIT 5
`;

console.log('\n\nCorvette Stingray samples:');
for (const row of corvettes) {
  console.log(`\n${row.year} ${row.make} ${row.model} ${row.display_trim}`);
  console.log('  oem_tire_sizes:', JSON.stringify(row.oem_tire_sizes, null, 2));
}

await sql.end();
