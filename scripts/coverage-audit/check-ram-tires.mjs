#!/usr/bin/env node
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

async function check() {
  console.log('=== 2014 RAM 1500 - ALL TRIMS ===\n');
  
  // Check all 2014 Ram 1500 records
  const records = await sql`
    SELECT display_trim, oem_tire_sizes, oem_wheel_sizes, source, bolt_pattern
    FROM vehicle_fitments 
    WHERE year = 2014 
      AND LOWER(make) = 'ram' 
      AND LOWER(model) = 'ram 1500'
    ORDER BY display_trim
  `;
  
  console.log(`Found ${records.length} records:\n`);
  
  for (const r of records) {
    const tires = r.oem_tire_sizes;
    const wheels = r.oem_wheel_sizes;
    const hasTires = tires && (Array.isArray(tires) ? tires.length > 0 : true);
    const hasWheels = wheels && (Array.isArray(wheels) ? wheels.length > 0 : true);
    
    console.log(`Trim: "${r.display_trim}"`);
    console.log(`  Bolt: ${r.bolt_pattern}`);
    console.log(`  OEM Tires: ${hasTires ? JSON.stringify(tires) : '❌ MISSING'}`);
    console.log(`  OEM Wheels: ${hasWheels ? JSON.stringify(wheels) : '❌ MISSING'}`);
    console.log(`  Source: ${r.source}`);
    console.log('');
  }
  
  // Also check for SLT specifically - case variations
  console.log('=== SEARCHING FOR "SLT" TRIM ===\n');
  const sltRecords = await sql`
    SELECT year, make, model, display_trim, oem_tire_sizes, source
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ram' 
      AND LOWER(model) LIKE '%1500%'
      AND LOWER(display_trim) LIKE '%slt%'
    ORDER BY year DESC
    LIMIT 20
  `;
  
  console.log(`Found ${sltRecords.length} SLT records:`);
  for (const r of sltRecords) {
    const hasTires = r.oem_tire_sizes && (Array.isArray(r.oem_tire_sizes) ? r.oem_tire_sizes.length > 0 : true);
    console.log(`  ${r.year} ${r.make} ${r.model} "${r.display_trim}" - Tires: ${hasTires ? '✓' : '❌'} (${r.source})`);
  }
  
  // Check how many Ram 1500 records are missing OEM tire sizes
  console.log('\n=== OEM TIRE COVERAGE FOR RAM 1500 ===\n');
  const coverage = await sql`
    SELECT 
      year,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text != '[]' AND oem_tire_sizes::text != 'null') as has_tires
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ram' 
      AND LOWER(model) = 'ram 1500'
    GROUP BY year
    ORDER BY year
  `;
  
  for (const r of coverage) {
    const pct = Math.round((Number(r.has_tires) / Number(r.total)) * 100);
    console.log(`  ${r.year}: ${r.has_tires}/${r.total} have tires (${pct}%)`);
  }
  
  await sql.end();
}

check().catch(console.error);
