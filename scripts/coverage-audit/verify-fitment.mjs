#!/usr/bin/env node
/**
 * Verify fitment data for key vehicles
 */
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const TEST_VEHICLES = [
  { make: 'RAM', model: 'Ram 1500', year: 2018 },
  { make: 'RAM', model: 'Ram 1500', year: 2022 },
  { make: 'RAM', model: 'Ram 2500', year: 2020 },
  { make: 'RAM', model: 'Ram 3500', year: 2022 },
  { make: 'Chevrolet', model: 'Silverado 1500', year: 2020 },
  { make: 'Chevrolet', model: 'Silverado 2500HD', year: 2020 },
  { make: 'Chevrolet', model: 'Silverado 3500HD', year: 2022 },
  { make: 'GMC', model: 'Sierra 1500', year: 2020 },
  { make: 'GMC', model: 'Sierra 2500HD', year: 2020 },
  { make: 'GMC', model: 'Sierra 3500HD', year: 2022 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2023 },
];

async function verify() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('FITMENT VERIFICATION - KEY VEHICLES');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  for (const v of TEST_VEHICLES) {
    const records = await sql`
      SELECT id, display_trim, bolt_pattern, center_bore_mm, 
             thread_size, seat_type, offset_min_mm, offset_max_mm,
             oem_wheel_sizes, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE LOWER(make) = ${v.make.toLowerCase()}
        AND LOWER(model) = ${v.model.toLowerCase()}
        AND year = ${v.year}
      LIMIT 3
    `;
    
    console.log(`${v.year} ${v.make} ${v.model}:`);
    
    if (records.length === 0) {
      console.log('  ❌ NO RECORDS FOUND\n');
      continue;
    }
    
    for (const r of records) {
      let wheels = r.oem_wheel_sizes || [];
      let tires = r.oem_tire_sizes || [];
      // Handle if it's a string
      if (typeof wheels === 'string') wheels = JSON.parse(wheels);
      if (typeof tires === 'string') tires = JSON.parse(tires);
      if (!Array.isArray(wheels)) wheels = [];
      if (!Array.isArray(tires)) tires = [];
      
      console.log(`  Trim: ${r.display_trim}`);
      console.log(`    Bolt Pattern: ${r.bolt_pattern || '❌ MISSING'}`);
      console.log(`    Center Bore: ${r.center_bore_mm ? r.center_bore_mm + 'mm' : '❌ MISSING'}`);
      console.log(`    Thread Size: ${r.thread_size || '–'}`);
      console.log(`    Offset Range: ${r.offset_min_mm ?? '?'} to ${r.offset_max_mm ?? '?'}mm`);
      console.log(`    OEM Wheels: ${wheels.length > 0 ? wheels.join(', ') : '❌ MISSING'}`);
      console.log(`    OEM Tires: ${tires.length > 0 ? tires.join(', ') : '❌ MISSING'}`);
      console.log(`    Source: ${r.source}`);
    }
    console.log('');
  }
  
  // Overall counts
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('OVERALL COUNTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const counts = await sql`
    SELECT 
      make, model, COUNT(*) as total,
      COUNT(*) FILTER (WHERE bolt_pattern IS NOT NULL) as has_bolt,
      COUNT(*) FILTER (WHERE oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text != '[]' AND oem_wheel_sizes::text != 'null') as has_wheels,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text != '[]' AND oem_tire_sizes::text != 'null') as has_tires
    FROM vehicle_fitments
    WHERE (LOWER(make) = 'ram' AND LOWER(model) IN ('ram 1500', 'ram 2500', 'ram 3500'))
       OR (LOWER(make) = 'chevrolet' AND LOWER(model) IN ('silverado 1500', 'silverado 2500hd', 'silverado 3500hd'))
       OR (LOWER(make) = 'gmc' AND LOWER(model) IN ('sierra 1500', 'sierra 2500hd', 'sierra 3500hd'))
       OR (LOWER(make) = 'hyundai' AND LOWER(model) = 'santa fe')
    GROUP BY make, model
    ORDER BY make, model
  `;
  
  console.log('Make/Model               | Total | Bolt | Wheels | Tires');
  console.log('─────────────────────────|───────|──────|────────|──────');
  for (const c of counts) {
    const name = `${c.make} ${c.model}`.padEnd(24);
    console.log(`${name} | ${String(c.total).padStart(5)} | ${String(c.has_bolt).padStart(4)} | ${String(c.has_wheels).padStart(6)} | ${String(c.has_tires).padStart(5)}`);
  }
  
  await sql.end();
}

verify().catch(console.error);
