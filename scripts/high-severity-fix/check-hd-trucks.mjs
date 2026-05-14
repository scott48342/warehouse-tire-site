import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const rows = await sql`
  SELECT year, make, model, display_trim, oem_tire_sizes, source
  FROM vehicle_fitments
  WHERE year = 2018 
    AND (model LIKE '%2500%' OR model LIKE '%3500%' OR model LIKE '%Express%' OR model LIKE '%Savana%')
    AND certification_status = 'certified'
  ORDER BY make, model, display_trim
  LIMIT 20
`;

console.log('2018 HD trucks/vans tire data:');
for (const r of rows) {
  console.log(`${r.make} ${r.model} "${r.display_trim}":`);
  console.log(`  tires: ${JSON.stringify(r.oem_tire_sizes)}`);
  console.log(`  source: ${r.source}`);
}

await sql.end();
