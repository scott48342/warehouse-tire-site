#!/usr/bin/env node
/**
 * Test Vehicle Audit Script
 * 
 * Checks migration status for critical test vehicles across all fitment sources.
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const TEST_VEHICLES = [
  { year: 2022, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2023, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 2500' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado 2500' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500' },
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2024, make: 'Ford', model: 'Bronco' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette' },
  { year: 2024, make: 'BMW', model: 'M3' },
  { year: 2024, make: 'Ram', model: '3500' },
];

async function checkVehicleFitments(year, make, model) {
  const result = await pool.query(`
    SELECT 
      year, make, model, display_trim, modification_id,
      bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
      oem_tire_sizes, oem_wheel_sizes,
      source, certification_status, quality_tier,
      created_at, updated_at
    FROM vehicle_fitments 
    WHERE year = $1 
      AND make ILIKE $2 
      AND model ILIKE $3
    ORDER BY display_trim
  `, [year, `%${make}%`, `%${model}%`]);
  
  return result.rows;
}

async function checkVehicleFitmentConfigurations(year, make, model) {
  const result = await pool.query(`
    SELECT 
      id, year, make_key, model_key, display_trim, modification_id,
      wheel_diameter, wheel_width, tire_size,
      is_default, source, source_confidence,
      created_at, updated_at
    FROM vehicle_fitment_configurations 
    WHERE year = $1 
      AND make_key ILIKE $2 
      AND model_key ILIKE $3
    ORDER BY display_trim, wheel_diameter
  `, [year, `%${make.toLowerCase()}%`, `%${model.toLowerCase()}%`]);
  
  return result.rows;
}

async function main() {
  console.log("=".repeat(80));
  console.log("TEST VEHICLE MIGRATION AUDIT");
  console.log("=".repeat(80));
  console.log("");

  const results = [];

  for (const v of TEST_VEHICLES) {
    console.log(`\n>>> ${v.year} ${v.make} ${v.model}`);
    console.log("-".repeat(60));
    
    const fitments = await checkVehicleFitments(v.year, v.make, v.model);
    const configs = await checkVehicleFitmentConfigurations(v.year, v.make, v.model);
    
    const status = {
      vehicle: `${v.year} ${v.make} ${v.model}`,
      inFitments: fitments.length,
      inConfigs: configs.length,
      status: 'unknown',
      trims: [],
      issues: [],
    };
    
    // Determine status
    if (fitments.length === 0 && configs.length === 0) {
      status.status = 'MISSING';
      status.issues.push('Not found in any table');
    } else if (fitments.length > 0 && configs.length === 0) {
      status.status = 'legacy_only';
    } else if (fitments.length === 0 && configs.length > 0) {
      status.status = 'config_only';
    } else {
      status.status = 'both_exist';
    }
    
    console.log(`  vehicle_fitments: ${fitments.length} records`);
    console.log(`  vehicle_fitment_configurations: ${configs.length} records`);
    console.log(`  Status: ${status.status}`);
    
    if (fitments.length > 0) {
      console.log(`\n  Fitments:`);
      for (const f of fitments.slice(0, 5)) {
        const tireSizes = Array.isArray(f.oem_tire_sizes) 
          ? f.oem_tire_sizes.join(', ')
          : JSON.stringify(f.oem_tire_sizes);
        console.log(`    - ${f.display_trim || '(no trim)'}: ${f.bolt_pattern || 'NO_BOLT'} | CB:${f.center_bore_mm || 'NULL'}mm | Tires: ${tireSizes || 'NONE'}`);
        status.trims.push(f.display_trim);
        
        // Check for issues
        if (!f.bolt_pattern) status.issues.push(`Missing bolt pattern: ${f.display_trim}`);
        if (!f.center_bore_mm) status.issues.push(`Missing center bore: ${f.display_trim}`);
        if (!f.oem_tire_sizes || f.oem_tire_sizes.length === 0) {
          status.issues.push(`Missing tire sizes: ${f.display_trim}`);
        }
      }
      if (fitments.length > 5) {
        console.log(`    ... and ${fitments.length - 5} more`);
      }
    }
    
    if (configs.length > 0) {
      console.log(`\n  Configurations:`);
      for (const c of configs.slice(0, 5)) {
        console.log(`    - ${c.trim || '(no trim)'}: ${c.wheel_diameter}"x${c.wheel_width}" → ${c.tire_size}`);
      }
      if (configs.length > 5) {
        console.log(`    ... and ${configs.length - 5} more`);
      }
    }
    
    if (status.issues.length > 0) {
      console.log(`\n  Issues:`);
      for (const issue of status.issues.slice(0, 5)) {
        console.log(`    ⚠️ ${issue}`);
      }
    }
    
    results.push(status);
  }
  
  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  
  const byStatus = {};
  for (const r of results) {
    byStatus[r.status] = byStatus[r.status] || [];
    byStatus[r.status].push(r.vehicle);
  }
  
  for (const [status, vehicles] of Object.entries(byStatus)) {
    console.log(`\n${status.toUpperCase()}:`);
    for (const v of vehicles) {
      console.log(`  - ${v}`);
    }
  }
  
  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
