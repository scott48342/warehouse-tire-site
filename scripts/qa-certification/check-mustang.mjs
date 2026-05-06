import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

async function checkMustang() {
  console.log('Checking mustang with case-insensitive search...\n');
  
  // Case insensitive search
  const records = await sql`
    SELECT year, make, model, modification_id, quality_tier,
           bolt_pattern, center_bore_mm, oem_wheel_sizes::text as wheels
    FROM vehicle_fitments 
    WHERE make ILIKE 'Ford'
      AND model ILIKE 'Mustang'
      AND year >= 2020
    ORDER BY year DESC, modification_id
    LIMIT 15
  `;
  
  console.log(`Found ${records.length} Mustang records (ILIKE):\n`);
  
  for (const r of records) {
    const tier = (r.quality_tier || 'null').padEnd(15);
    console.log(`${r.year} ${r.make} ${r.model} ${(r.modification_id || 'Base').padEnd(40)} tier=${tier}`);
    console.log(`    bolt=${r.bolt_pattern}, bore=${r.center_bore_mm}mm`);
    if (r.wheels) {
      try {
        const wheels = JSON.parse(r.wheels);
        const widths = wheels.map(w => w.width || w.rimWidth).filter(Boolean);
        const hasPosition = wheels.some(w => w.position || w.front || w.rear);
        console.log(`    wheels: ${wheels.length} specs, widths=${widths.join(',')} hasPosition=${hasPosition}`);
      } catch {}
    }
    console.log('');
  }
  
  await sql.end();
}

checkMustang().catch(e => { console.error(e); process.exit(1); });
