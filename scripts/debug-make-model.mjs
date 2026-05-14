import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Check the EXACT make values for both model variants
const rows = await sql`
  SELECT make, model, COUNT(*) as cnt
  FROM vehicle_fitments
  WHERE year = 2024
    AND (model = 'E-Class' OR model = 'e-class' OR model ILIKE '%e-class%')
  GROUP BY make, model
  ORDER BY make, model
`;

console.log('Make/Model combinations for E-Class:');
for (const r of rows) {
  console.log(`  make="${r.make}" model="${r.model}" count=${r.cnt}`);
}

await sql.end();
