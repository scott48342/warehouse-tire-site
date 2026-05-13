#!/usr/bin/env node
/**
 * USAF Enrichment Verification
 * 
 * Verifies sentinel vehicles have correct tire sizes after enrichment.
 * Direct DB queries - no API needed.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

// Sentinel vehicles that must pass
const SENTINEL_VEHICLES = [
  { year: 2022, make: "Ford", model: "F-150 Lightning", minTrims: 1, minSizes: 1 },
  { year: 2023, make: "Ford", model: "F-150 Lightning", minTrims: 1, minSizes: 1 },
  { year: 2022, make: "Chevrolet", model: "Silverado 2500 HD", minTrims: 1, minSizes: 1 },
  { year: 2023, make: "Chevrolet", model: "Silverado 2500 HD", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "Chevrolet", model: "Silverado 2500 HD", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "Toyota", model: "Tacoma", minTrims: 1, minSizes: 1 },
  { year: 2025, make: "Ford", model: "Bronco", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "Chevrolet", model: "Corvette", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "BMW", model: "M3", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "Ram", model: "3500", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "Ford", model: "F-150", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "Toyota", model: "Camry", minTrims: 1, minSizes: 1 },
  { year: 2024, make: "Honda", model: "Civic", minTrims: 1, minSizes: 1 },
  // Recently enriched vehicles
  { year: 2025, make: "BMW", model: "X5", minTrims: 1, minSizes: 5 },
  { year: 2024, make: "BMW", model: "X3", minTrims: 1, minSizes: 3 },
  { year: 2025, make: "Chevrolet", model: "Silverado 1500", minTrims: 1, minSizes: 1 },
];

async function checkVehicle(year, make, model) {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT display_trim) as trim_count,
           COUNT(*) as record_count,
           MIN(COALESCE(jsonb_array_length(oem_tire_sizes::jsonb), 0)) as min_sizes,
           MAX(COALESCE(jsonb_array_length(oem_tire_sizes::jsonb), 0)) as max_sizes
    FROM vehicle_fitments
    WHERE year = $1 
      AND LOWER(make) = LOWER($2)
      AND (LOWER(model) = LOWER($3) OR LOWER(model) = LOWER($4))
      AND certification_status = 'certified'
  `, [year, make, model, model.replace(/ /g, '-')]);
  
  return result.rows[0];
}

async function getSampleSizes(year, make, model) {
  const result = await pool.query(`
    SELECT display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE year = $1 
      AND LOWER(make) = LOWER($2)
      AND (LOWER(model) = LOWER($3) OR LOWER(model) = LOWER($4))
      AND certification_status = 'certified'
    LIMIT 1
  `, [year, make, model, model.replace(/ /g, '-')]);
  
  return result.rows[0];
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('USAF ENRICHMENT VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const vehicle of SENTINEL_VEHICLES) {
    const stats = await checkVehicle(vehicle.year, vehicle.make, vehicle.model);
    const trimCount = parseInt(stats.trim_count || 0);
    const minSizes = parseInt(stats.min_sizes || 0);
    const maxSizes = parseInt(stats.max_sizes || 0);
    
    const ok = trimCount >= vehicle.minTrims && minSizes >= vehicle.minSizes;
    
    if (ok) {
      console.log(`✅ ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${trimCount} trims, ${minSizes}-${maxSizes} sizes`);
      passed++;
    } else {
      console.log(`❌ ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${trimCount} trims, ${minSizes}-${maxSizes} sizes (expected ${vehicle.minTrims}+ trims, ${vehicle.minSizes}+ sizes)`);
      failed++;
      failures.push(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    }
  }
  
  console.log('');
  console.log('───────────────────────────────────────────────────────────────────────');
  
  // Check recently enriched samples
  console.log('');
  console.log('📋 Sample enriched data:');
  
  const enrichedSamples = [
    { year: 2025, make: 'BMW', model: 'X5' },
    { year: 2024, make: 'Ford', model: 'F-150' },
    { year: 2025, make: 'Chevrolet', model: 'Silverado 1500' },
  ];
  
  for (const sample of enrichedSamples) {
    const data = await getSampleSizes(sample.year, sample.make, sample.model);
    if (data) {
      const sizes = Array.isArray(data.oem_tire_sizes) ? data.oem_tire_sizes : [];
      console.log(`   ${sample.year} ${sample.make} ${sample.model} [${data.display_trim}]:`);
      console.log(`     ${sizes.join(', ')}`);
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  if (failed === 0) {
    console.log(`✅ ALL ${passed} SENTINEL VEHICLES PASSED`);
    console.log('   No regressions detected.');
  } else {
    console.log(`❌ ${failed}/${passed + failed} SENTINEL VEHICLES FAILED`);
    console.log('   Failures:', failures.join(', '));
  }
  
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // Get total stats
  const totalStats = await pool.query(`
    SELECT COUNT(*) as total_records,
           COUNT(DISTINCT year || make || model) as unique_vehicles
    FROM vehicle_fitments
    WHERE certification_status = 'certified'
  `);
  
  console.log(`📊 Database Stats:`);
  console.log(`   Total certified records: ${totalStats.rows[0].total_records}`);
  console.log(`   Unique vehicles (YMM): ${totalStats.rows[0].unique_vehicles}`);
  console.log('');
  
  await pool.end();
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
