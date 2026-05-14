import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const counts = await sql`
  SELECT certification_status, COUNT(*) as cnt
  FROM vehicle_fitments
  GROUP BY certification_status
  ORDER BY cnt DESC
`;

console.log('Certification status counts:');
for (const c of counts) {
  console.log(`  ${c.certification_status || 'NULL'}: ${c.cnt}`);
}

// Also count fake Front/Rear trims by status
const fakeCounts = await sql`
  SELECT certification_status, COUNT(*) as cnt
  FROM vehicle_fitments
  WHERE display_trim LIKE '%Front %' OR display_trim LIKE '%Rear %'
  GROUP BY certification_status
  ORDER BY cnt DESC
`;

console.log('\nFake Front/Rear trims by status:');
for (const c of fakeCounts) {
  console.log(`  ${c.certification_status || 'NULL'}: ${c.cnt}`);
}

await sql.end();
