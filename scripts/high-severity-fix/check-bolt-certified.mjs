import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Check certified records with missing bolt pattern (excluding deprecated)
const rows = await sql`
  SELECT id, year, make, model, display_trim, bolt_pattern, certification_status
  FROM vehicle_fitments
  WHERE (bolt_pattern IS NULL OR bolt_pattern = '')
    AND certification_status = 'certified'
  ORDER BY year DESC, make, model
`;

console.log(`Records with missing bolt pattern (certified only): ${rows.length}`);
for (const r of rows) {
  const isFake = /Front |Rear /i.test(r.display_trim);
  console.log(`${r.year} ${r.make} ${r.model} "${r.display_trim}"${isFake ? ' [FAKE FRONT/REAR]' : ''}`);
}

await sql.end();
