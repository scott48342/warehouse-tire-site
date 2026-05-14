import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Test the regex from the audit
const TIRE_SIZE_REGEX = /^(P|LT)?(\d{2,3})\/(\d{2,3})(Z?R|RF|HL|B|D)?(\d{2})(\.5)?(C|D|E|F|G|H|J|L|M|N|P|Q|R|S|T|U|V|W|Y|Z)?(\d{2,3})?(V|W|Y|Z)?$/i;

// Test cases
const testCases = [
  'LT265/60R20/E',      // HD truck format
  'LT265/60R20',        // Standard LT
  '265/60R20',          // Standard
  '275/35ZR19',         // Performance ZR
  'P265/70R17',         // P-metric
  '37x12.50R17LT',      // Flotation
];

console.log('Regex tests:');
for (const tc of testCases) {
  const match = TIRE_SIZE_REGEX.test(tc);
  console.log(`  "${tc}": ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
}

// Now check what's actually in the DB for 2018 HD trucks
const rows = await sql`
  SELECT display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE year = 2018 AND make = 'Chevrolet' AND model = 'Silverado 2500 HD'
  LIMIT 3
`;

console.log('\n2018 Silverado 2500 HD actual tire data:');
for (const r of rows) {
  console.log(`"${r.display_trim}": ${JSON.stringify(r.oem_tire_sizes)}`);
  if (Array.isArray(r.oem_tire_sizes)) {
    for (const size of r.oem_tire_sizes) {
      const match = TIRE_SIZE_REGEX.test(size);
      console.log(`  "${size}": ${match ? '✅' : '❌'}`);
    }
  }
}

await sql.end();
