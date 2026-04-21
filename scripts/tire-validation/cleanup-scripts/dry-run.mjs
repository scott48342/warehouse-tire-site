#!/usr/bin/env node
/**
 * Dry Run - Show what the cleanup would affect
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

// Load .env.local manually
const envPath = join(__dirname, '..', '..', '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

if (!connectionString) {
  console.error('❌ Could not find POSTGRES_URL in .env.local');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('🔧 TIRE DATA CLEANUP - DRY RUN');
    console.log('='.repeat(60));
    
    // Current total
    const total = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
    console.log(`\n📊 Current total records: ${total.rows[0].count}\n`);

    // ============================================================
    // PHANTOM YEARS
    // ============================================================
    console.log('='.repeat(60));
    console.log('1️⃣  PHANTOM YEARS TO DELETE');
    console.log('='.repeat(60));
    
    const phantomYears = await client.query(`
      SELECT make, model, year, COUNT(*) as records
      FROM vehicle_fitments
      WHERE 
        (make ILIKE 'Toyota' AND model ILIKE 'FJ Cruiser' AND year > 2014)
        OR (make ILIKE 'Toyota' AND model ILIKE 'Land Cruiser' AND year BETWEEN 2021 AND 2023)
        OR (make ILIKE 'Toyota' AND model ILIKE 'Prius Plug-in' AND year > 2015)
        OR (make ILIKE 'Toyota' AND model ILIKE 'Prius V' AND year > 2017)
        OR (make ILIKE 'Toyota' AND model ILIKE 'Yaris' AND year > 2020)
        OR (make ILIKE 'Toyota' AND model ILIKE 'Venza' AND year IN (2016, 2017, 2018, 2019, 2020))
        OR (make ILIKE 'Toyota' AND model ILIKE 'Supra' AND year BETWEEN 2000 AND 2018)
        OR (make ILIKE 'Toyota' AND model ILIKE 'GR86' AND year < 2022)
        OR (make ILIKE 'Toyota' AND model ILIKE 'Mirai' AND year < 2016)
        OR (make ILIKE 'Volkswagen' AND model ILIKE 'Beetle' AND year > 2019)
        OR (make ILIKE 'Volkswagen' AND model ILIKE 'ID.4' AND year < 2021)
        OR (make ILIKE 'Volkswagen' AND model ILIKE 'Passat' AND year > 2022)
        OR (make ILIKE 'Volkswagen' AND model ILIKE 'Taos' AND year < 2022)
        OR (make ILIKE 'Volkswagen' AND model ILIKE 'Touareg' AND year > 2017)
        OR (make ILIKE 'Volkswagen' AND model ILIKE 'Tiguan' AND year < 2009)
        OR (make ILIKE 'Subaru' AND model ILIKE '%WRX%STI%' AND year > 2021)
        OR (make ILIKE 'Volvo' AND model ILIKE 'S60' AND year IN (2000, 2010))
        OR (make ILIKE 'Volvo' AND model ILIKE 'V60' AND year BETWEEN 2010 AND 2014)
        OR (make ILIKE 'Volvo' AND model ILIKE 'XC40' AND year < 2019)
        OR (make ILIKE 'Volvo' AND model ILIKE 'XC60' AND year < 2010)
        OR (make ILIKE 'Volvo' AND model ILIKE 'XC90' AND year = 2015)
        OR (make ILIKE 'Lexus' AND model ILIKE 'NX' AND year < 2015)
        OR (make ILIKE 'Lexus' AND model ILIKE 'RC' AND year < 2015)
        OR (make ILIKE 'Kia' AND model ILIKE 'EV6' AND year < 2022)
        OR (make ILIKE 'Kia' AND model ILIKE 'EV9' AND year < 2024)
        OR (make ILIKE 'Kia' AND model ILIKE 'Forte' AND year < 2010)
        OR (make ILIKE 'Kia' AND model ILIKE 'Niro' AND year < 2017)
      GROUP BY make, model, year
      ORDER BY make, model, year
    `);
    
    let phantomTotal = 0;
    for (const row of phantomYears.rows) {
      console.log(`  ${row.make} ${row.model} ${row.year}: ${row.records} record(s)`);
      phantomTotal += parseInt(row.records);
    }
    console.log(`\n  📍 TOTAL PHANTOM YEARS TO DELETE: ${phantomTotal}\n`);

    // ============================================================
    // NON-US VEHICLES
    // ============================================================
    console.log('='.repeat(60));
    console.log('2️⃣  NON-US VEHICLES TO DELETE');
    console.log('='.repeat(60));
    
    const nonUS = await client.query(`
      SELECT make, model, COUNT(*) as records
      FROM vehicle_fitments
      WHERE model ILIKE ANY(ARRAY[
        'Allex', 'Altezza%', 'Aristo', 'Avensis%', 'Blade', 'Caldina',
        'Celsior', 'Funcargo', 'Gaia', 'Hilux Surf', 'MR-S', 'Soarer',
        'Vista%', 'Windom', 'Avanza', 'Calya', 'C-Pod', 'Innova%',
        'JPN Taxi', 'Quantum', 'Rukus', 'Pronard', 'Hilux%',
        'Cross Lavida', 'ID.4 Crozz', 'ID Unyx', 'Jetta City',
        'Jetta King', 'Jetta Pioneer', 'Polo%', 'Tacqua', 'Taigo',
        'Tayron%', 'Tharu%', 'V40%', 'Avella', 'Besta', 'Carstar',
        'Enterprise', 'Picanto', 'Morning'
      ])
      GROUP BY make, model
      ORDER BY make, model
    `);
    
    let nonUSTotal = 0;
    for (const row of nonUS.rows) {
      console.log(`  ${row.make} ${row.model}: ${row.records} record(s)`);
      nonUSTotal += parseInt(row.records);
    }
    console.log(`\n  📍 TOTAL NON-US VEHICLES TO DELETE: ${nonUSTotal}\n`);

    // ============================================================
    // WRONG TIRE SIZES (sample)
    // ============================================================
    console.log('='.repeat(60));
    console.log('3️⃣  WRONG TIRE SIZES TO FIX (samples)');
    console.log('='.repeat(60));
    
    const wrongSizes = await client.query(`
      SELECT make, model, year, tire_sizes::text as current_sizes
      FROM vehicle_fitments
      WHERE 
        (make ILIKE 'Toyota' AND model ILIKE 'Corolla Cross' AND year = 2024)
        OR (make ILIKE 'Toyota' AND model ILIKE 'GR Corolla' AND year = 2024)
        OR (make ILIKE 'Toyota' AND model ILIKE 'Prius' AND model NOT ILIKE '%Prime%' AND year = 2024)
        OR (make ILIKE 'Volkswagen' AND model ILIKE 'GTI' AND year = 2024)
        OR (make ILIKE 'Lexus' AND model ILIKE 'LX%' AND year = 2024)
        OR (make ILIKE 'Volvo' AND model ILIKE 'XC90' AND year = 2010)
      ORDER BY make, model, year
      LIMIT 10
    `);
    
    for (const row of wrongSizes.rows) {
      console.log(`  ${row.make} ${row.model} ${row.year}:`);
      console.log(`    Current: ${row.current_sizes || '[]'}`);
    }
    console.log(`\n  📍 ~400 records will be updated with correct sizes\n`);

    // ============================================================
    // EMPTY RECORDS
    // ============================================================
    console.log('='.repeat(60));
    console.log('4️⃣  EMPTY RECORDS TO POPULATE');
    console.log('='.repeat(60));
    
    const empty = await client.query(`
      SELECT make, model, COUNT(*) as records
      FROM vehicle_fitments
      WHERE tire_sizes IS NULL 
         OR tire_sizes = '[]'::jsonb 
         OR tire_sizes::text = '[]'
         OR jsonb_array_length(tire_sizes) = 0
      GROUP BY make, model
      ORDER BY records DESC
      LIMIT 20
    `);
    
    let emptyTotal = 0;
    for (const row of empty.rows) {
      console.log(`  ${row.make} ${row.model}: ${row.records} empty record(s)`);
      emptyTotal += parseInt(row.records);
    }
    
    const emptyTotalQuery = await client.query(`
      SELECT COUNT(*) as count FROM vehicle_fitments
      WHERE tire_sizes IS NULL 
         OR tire_sizes = '[]'::jsonb 
         OR tire_sizes::text = '[]'
         OR jsonb_array_length(tire_sizes) = 0
    `);
    console.log(`\n  📍 TOTAL EMPTY RECORDS: ${emptyTotalQuery.rows[0].count}\n`);

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('='.repeat(60));
    console.log('📋 DRY RUN SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Current records:     ${total.rows[0].count}`);
    console.log(`  Phantom years:       -${phantomTotal}`);
    console.log(`  Non-US vehicles:     -${nonUSTotal}`);
    console.log(`  Records to update:   ~400`);
    console.log(`  Empty to populate:   ${emptyTotalQuery.rows[0].count}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  Estimated after:     ~${parseInt(total.rows[0].count) - phantomTotal - nonUSTotal}`);
    console.log('\n✅ Dry run complete. Run without --dry-run to execute.\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
