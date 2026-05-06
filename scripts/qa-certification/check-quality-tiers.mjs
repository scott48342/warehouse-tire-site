import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

async function checkTiers() {
  console.log('Checking quality tiers for staggered vehicles...\n');
  
  const records = await sql`
    SELECT year, make, model, modification_id, quality_tier,
           oem_wheel_sizes::text as wheels, oem_tire_sizes::text as tires
    FROM vehicle_fitments 
    WHERE make IN ('Ford', 'Chevrolet', 'Dodge')
      AND model IN ('Mustang', 'Camaro', 'Corvette', 'Challenger', 'Charger')
      AND year >= 2020
    ORDER BY make, model, year DESC, modification_id
    LIMIT 30
  `;
  
  console.log('STAGGERED VEHICLE QUALITY TIERS:');
  console.log('─'.repeat(100));
  
  for (const r of records) {
    const tier = (r.quality_tier || 'null').padEnd(15);
    console.log(`${r.year} ${r.make.padEnd(12)} ${r.model.padEnd(12)} ${(r.modification_id || 'Base').padEnd(25)} tier=${tier}`);
    
    // Show wheel data to understand why tier isn't complete
    if (r.wheels) {
      try {
        const wheels = JSON.parse(r.wheels);
        // Check if it has position data
        const hasPosition = wheels.some(w => w.position || w.front || w.rear);
        const widths = wheels.map(w => w.width || w.rimWidth).filter(Boolean);
        const hasDiffWidths = widths.length >= 2 && (Math.max(...widths) - Math.min(...widths) >= 2);
        console.log(`    wheels: ${wheels.length} specs, hasPosition=${hasPosition}, hasDiffWidths=${hasDiffWidths}`);
        if (widths.length > 0) {
          console.log(`    widths: ${widths.join(', ')}`);
        }
      } catch {}
    }
  }
  
  // Summary stats
  console.log('\n\nQUALITY TIER SUMMARY (2020+ performance vehicles):');
  console.log('─'.repeat(50));
  const stats = await sql`
    SELECT quality_tier, COUNT(*) as count
    FROM vehicle_fitments
    WHERE make IN ('Ford', 'Chevrolet', 'Dodge', 'BMW', 'Mercedes-Benz')
      AND model IN ('Mustang', 'Camaro', 'Corvette', 'Challenger', 'Charger', 'M3', '3 Series', 'AMG C 63')
      AND year >= 2020
    GROUP BY quality_tier
    ORDER BY count DESC
  `;
  for (const s of stats) {
    console.log(`  ${(s.quality_tier || 'null').padEnd(15)}: ${s.count}`);
  }
  
  await sql.end();
}

checkTiers().catch(e => { console.error(e); process.exit(1); });
