import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

(async () => {
  const rows = await sql`SELECT year, display_trim, oem_tire_sizes FROM vehicle_fitments WHERE make='Chevrolet' AND model='Corvette' AND year >= 2024 ORDER BY year DESC, display_trim`;
  console.log('=== Corvettes 2024+ ===');
  for (const r of rows) {
    const format = r.oem_tire_sizes?.front ? '✅' : '❌';
    console.log(`${format} ${r.year} ${r.display_trim}:`, JSON.stringify(r.oem_tire_sizes));
  }
  await sql.end();
})();
