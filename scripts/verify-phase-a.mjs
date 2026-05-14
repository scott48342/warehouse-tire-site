#!/usr/bin/env node
/**
 * Verify Phase A v2 apply results
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

async function verify() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   PHASE A v2 VERIFICATION                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check Camaro SS 1LE
  const camaro = await sql`
    SELECT year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE make='Chevrolet' AND model='Camaro' AND display_trim ILIKE '%SS 1LE%' AND year >= 2020 
    ORDER BY year DESC LIMIT 5
  `;
  console.log('=== Camaro SS 1LE ===');
  for (const r of camaro) {
    const format = r.oem_tire_sizes?.front ? '✅ CANONICAL' : '❌ ARRAY';
    console.log(`${r.year} ${r.display_trim}: ${format}`, JSON.stringify(r.oem_tire_sizes));
  }

  // Check Camaro ZL1 1LE
  const zl1 = await sql`
    SELECT year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE make='Chevrolet' AND model='Camaro' AND display_trim ILIKE '%ZL1 1LE%' AND year >= 2020 
    ORDER BY year DESC LIMIT 5
  `;
  console.log('\n=== Camaro ZL1 1LE ===');
  for (const r of zl1) {
    const format = r.oem_tire_sizes?.front ? '✅ CANONICAL' : '❌ ARRAY';
    console.log(`${r.year} ${r.display_trim}: ${format}`, JSON.stringify(r.oem_tire_sizes));
  }

  // Check Corvette Stingray
  const stingray = await sql`
    SELECT year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE make='Chevrolet' AND model='Corvette' AND display_trim ILIKE '%Stingray%' AND year >= 2020 
    ORDER BY year DESC LIMIT 5
  `;
  console.log('\n=== Corvette Stingray ===');
  for (const r of stingray) {
    const format = r.oem_tire_sizes?.front ? '✅ CANONICAL' : '❌ ARRAY';
    console.log(`${r.year} ${r.display_trim}: ${format}`, JSON.stringify(r.oem_tire_sizes));
  }

  // Check Corvette Z06
  const z06 = await sql`
    SELECT year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE make='Chevrolet' AND model='Corvette' AND display_trim ILIKE '%Z06%' AND year >= 2020 
    ORDER BY year DESC LIMIT 5
  `;
  console.log('\n=== Corvette Z06 ===');
  for (const r of z06) {
    const format = r.oem_tire_sizes?.front ? '✅ CANONICAL' : '❌ ARRAY';
    console.log(`${r.year} ${r.display_trim}: ${format}`, JSON.stringify(r.oem_tire_sizes));
  }

  // Check Mustang GT
  const mustang = await sql`
    SELECT year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE make='Ford' AND model='Mustang' AND display_trim ILIKE '%GT%' AND year >= 2020 
    ORDER BY year DESC LIMIT 5
  `;
  console.log('\n=== Mustang GT ===');
  for (const r of mustang) {
    const format = r.oem_tire_sizes?.front ? '✅ CANONICAL' : '❌ ARRAY';
    console.log(`${r.year} ${r.display_trim}: ${format}`, JSON.stringify(r.oem_tire_sizes));
  }

  // Check Shelby GT350/GT500
  const shelby = await sql`
    SELECT year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE make='Ford' AND model='Mustang' AND (display_trim ILIKE '%GT350%' OR display_trim ILIKE '%GT500%') AND year >= 2020 
    ORDER BY year DESC LIMIT 5
  `;
  console.log('\n=== Mustang Shelby ===');
  for (const r of shelby) {
    const format = r.oem_tire_sizes?.front ? '✅ CANONICAL' : '❌ ARRAY';
    console.log(`${r.year} ${r.display_trim}: ${format}`, JSON.stringify(r.oem_tire_sizes));
  }

  // Check BMW M3
  const m3 = await sql`
    SELECT year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE make='BMW' AND model='M3' AND year >= 2021 
    ORDER BY year DESC LIMIT 5
  `;
  console.log('\n=== BMW M3 ===');
  for (const r of m3) {
    const format = r.oem_tire_sizes?.front ? '✅ CANONICAL' : '❌ ARRAY';
    console.log(`${r.year} ${r.display_trim}: ${format}`, JSON.stringify(r.oem_tire_sizes));
  }

  // Check BMW M4
  const m4 = await sql`
    SELECT year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE make='BMW' AND model='M4' AND year >= 2021 
    ORDER BY year DESC LIMIT 5
  `;
  console.log('\n=== BMW M4 ===');
  for (const r of m4) {
    const format = r.oem_tire_sizes?.front ? '✅ CANONICAL' : '❌ ARRAY';
    console.log(`${r.year} ${r.display_trim}: ${format}`, JSON.stringify(r.oem_tire_sizes));
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Format legend:');
  console.log('  ✅ CANONICAL = { front: "...", rear: "..." }');
  console.log('  ❌ ARRAY     = ["...", "..."] (not yet converted)');

  await sql.end();
}

verify().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
