import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

(async () => {
  // Mustang GT/Shelby
  console.log('=== MUSTANG GT/SHELBY (multi-size) ===\n');
  const mustang = await sql`
    SELECT year, display_trim, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make='Ford' AND model='Mustang' 
      AND (display_trim ILIKE '%GT%' OR display_trim ILIKE '%Shelby%')
    ORDER BY year DESC, display_trim
  `;
  
  for (const r of mustang) {
    const ts = r.oem_tire_sizes;
    const count = Array.isArray(ts) ? ts.length : (ts?.front ? 2 : 0);
    const format = ts?.front ? '✅ CANONICAL' : `❌ ARRAY (${count} sizes)`;
    console.log(`${r.year} ${r.display_trim}: ${format}`);
    if (Array.isArray(ts) && ts.length > 2) {
      console.log(`   Sizes: ${ts.join(', ')}`);
    }
  }

  // BMW M3 CS
  console.log('\n=== BMW M3 CS (multi-size) ===\n');
  const m3cs = await sql`
    SELECT year, display_trim, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make='BMW' AND model='M3' AND display_trim ILIKE '%CS%'
    ORDER BY year DESC
  `;
  
  for (const r of m3cs) {
    const ts = r.oem_tire_sizes;
    const count = Array.isArray(ts) ? ts.length : (ts?.front ? 2 : 0);
    const format = ts?.front ? '✅ CANONICAL' : `❌ ARRAY (${count} sizes)`;
    console.log(`${r.year} ${r.display_trim}: ${format}`);
    if (Array.isArray(ts)) {
      console.log(`   Sizes: ${ts.join(', ')}`);
    }
  }

  await sql.end();
})();
