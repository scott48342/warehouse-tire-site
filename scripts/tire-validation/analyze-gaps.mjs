#!/usr/bin/env node
/**
 * Analyze missing wheel and tire data gaps
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const envPath = join(__dirname, '..', '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 ANALYZING MISSING DATA GAPS');
  console.log('='.repeat(70));

  // ============================================================
  // MISSING WHEEL SIZES (11.4%)
  // ============================================================
  console.log('\n🔩 MISSING WHEEL SIZES - By Make/Model');
  console.log('-'.repeat(70));
  
  const missingWheels = await client.query(`
    SELECT make, model, COUNT(*) as missing_count,
           MIN(year) as min_year, MAX(year) as max_year
    FROM vehicle_fitments 
    WHERE oem_wheel_sizes IS NULL 
       OR oem_wheel_sizes = '[]'::jsonb 
       OR jsonb_array_length(oem_wheel_sizes) = 0
    GROUP BY make, model
    ORDER BY COUNT(*) DESC
    LIMIT 40
  `);
  
  console.log('Make                Model                      Count   Years');
  console.log('-'.repeat(70));
  let totalMissingWheels = 0;
  for (const row of missingWheels.rows) {
    console.log(`${row.make.padEnd(20)} ${row.model.padEnd(25)} ${String(row.missing_count).padStart(5)}   ${row.min_year}-${row.max_year}`);
    totalMissingWheels += parseInt(row.missing_count);
  }
  
  const totalMissingWheelsQuery = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR jsonb_array_length(oem_wheel_sizes) = 0
  `);
  console.log(`\nTotal missing wheel sizes: ${totalMissingWheelsQuery.rows[0].count}`);

  // ============================================================
  // MISSING TIRE SIZES (15.5%)
  // ============================================================
  console.log('\n\n🛞 MISSING TIRE SIZES - By Make/Model');
  console.log('-'.repeat(70));
  
  const missingTires = await client.query(`
    SELECT make, model, COUNT(*) as missing_count,
           MIN(year) as min_year, MAX(year) as max_year
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NULL 
       OR oem_tire_sizes = '[]'::jsonb 
       OR jsonb_array_length(oem_tire_sizes) = 0
    GROUP BY make, model
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `);
  
  console.log('Make                Model                      Count   Years');
  console.log('-'.repeat(70));
  for (const row of missingTires.rows) {
    console.log(`${row.make.padEnd(20)} ${row.model.padEnd(25)} ${String(row.missing_count).padStart(5)}   ${row.min_year}-${row.max_year}`);
  }
  
  const totalMissingTiresQuery = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR jsonb_array_length(oem_tire_sizes) = 0
  `);
  console.log(`\nTotal missing tire sizes: ${totalMissingTiresQuery.rows[0].count}`);

  // ============================================================
  // ANALYSIS BY CATEGORY
  // ============================================================
  console.log('\n\n📈 MISSING DATA BY CATEGORY');
  console.log('-'.repeat(70));
  
  // Performance/Special variants
  const performance = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      AND (model ILIKE '%wrx%' OR model ILIKE '%sti%' OR model ILIKE '%-m' 
           OR model ILIKE '%amg%' OR model ILIKE '%-v' OR model ILIKE '%sport%'
           OR model ILIKE '%gt%' OR model ILIKE '%rs%' OR model ILIKE '%ss%')
  `);
  console.log(`Performance variants (WRX, STI, M, AMG, etc.): ${performance.rows[0].count}`);
  
  // Commercial/Work vehicles
  const commercial = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      AND (model ILIKE '%transit%' OR model ILIKE '%econoline%' 
           OR model ILIKE '%savana%' OR model ILIKE '%express%'
           OR model ILIKE '%sprinter%' OR model ILIKE '%promaster%')
  `);
  console.log(`Commercial/Work vehicles: ${commercial.rows[0].count}`);
  
  // Luxury/Rare
  const luxury = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      AND (make ILIKE 'ferrari' OR make ILIKE 'lamborghini' OR make ILIKE 'mclaren'
           OR make ILIKE 'bentley' OR make ILIKE 'rolls%' OR make ILIKE 'aston%'
           OR make ILIKE 'maserati' OR make ILIKE 'bugatti' OR make ILIKE 'lotus')
  `);
  console.log(`Exotic/Luxury brands: ${luxury.rows[0].count}`);
  
  // Very old vehicles
  const veryOld = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      AND year < 2000
  `);
  console.log(`Pre-2000 vehicles: ${veryOld.rows[0].count}`);
  
  // Recent years (fixable)
  const recent = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      AND year >= 2015
  `);
  console.log(`2015+ vehicles (easily fixable): ${recent.rows[0].count}`);

  // ============================================================
  // HIGH-PRIORITY GAPS (Recent, Popular)
  // ============================================================
  console.log('\n\n🎯 HIGH-PRIORITY GAPS (2015+, Popular Makes)');
  console.log('-'.repeat(70));
  
  const highPriority = await client.query(`
    SELECT make, model, COUNT(*) as missing_count,
           MIN(year) as min_year, MAX(year) as max_year
    FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR jsonb_array_length(oem_tire_sizes) = 0)
      AND year >= 2015
      AND make IN ('ford', 'chevrolet', 'toyota', 'honda', 'nissan', 'ram', 'gmc', 
                   'jeep', 'dodge', 'hyundai', 'kia', 'subaru', 'mazda', 'volkswagen')
    GROUP BY make, model
    ORDER BY COUNT(*) DESC
    LIMIT 30
  `);
  
  console.log('Make                Model                      Count   Years');
  console.log('-'.repeat(70));
  let highPriorityTotal = 0;
  for (const row of highPriority.rows) {
    console.log(`${row.make.padEnd(20)} ${row.model.padEnd(25)} ${String(row.missing_count).padStart(5)}   ${row.min_year}-${row.max_year}`);
    highPriorityTotal += parseInt(row.missing_count);
  }
  console.log(`\nHigh-priority fixable: ${highPriorityTotal} records`);
  
  await client.end();
}

main().catch(console.error);
