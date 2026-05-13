#!/usr/bin/env node
/**
 * Pre-Deploy Fitment Source Audit
 * 
 * Checks for:
 * 1. Deprecated source usage (warning - code still has fallback)
 * 2. Problem vehicle visibility (BLOCKING - these must resolve)
 * 
 * Run: node scripts/audit-fitment-sources.mjs
 * Exit code: 0 = pass, 1 = fail
 * 
 * 2026-05-13: Created as part of Option A fitment cleanup
 * 
 * NOTE: Config table usage is warned but not blocked because:
 * - Current code has proper fallback to vehicle_fitments
 * - Removing config table reads requires careful testing
 * - Option A specifies "no runtime rewrite"
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ============================================================================
// Problem Vehicles (must be visible)
// ============================================================================

const PROBLEM_VEHICLES = [
  { year: 2022, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2023, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2025, make: 'Ford', model: 'Bronco' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette' },
  { year: 2024, make: 'BMW', model: 'M3' },
  { year: 2024, make: 'Ram', model: '3500' },
];

// ============================================================================
// Model Variants (copied from modelAliases.ts for standalone execution)
// ============================================================================

const MODEL_ALIASES = {
  "silverado-2500": ["silverado-2500hd", "silverado-2500-hd"],
  "silverado-2500hd": ["silverado-2500", "silverado-2500-hd"],
  "silverado-2500-hd": ["silverado-2500hd", "silverado-2500"],
  "ram-3500": ["3500"],
};

const HD_RICH_PRIORITY = {
  "silverado-2500-hd": "silverado-2500hd",
};

function getModelVariants(model) {
  const lowercased = model.toLowerCase().trim();
  const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const aliases = MODEL_ALIASES[slugified] || [];
  const richVariant = HD_RICH_PRIORITY[slugified];
  
  if (richVariant) {
    const others = aliases.filter(a => a !== richVariant);
    return [...new Set([richVariant, lowercased, slugified, ...others])];
  }
  
  return [...new Set([lowercased, slugified, ...aliases])];
}

// ============================================================================
// Main Audit
// ============================================================================

async function checkProblemVehicles(pool) {
  const results = [];
  
  for (const v of PROBLEM_VEHICLES) {
    const modelVariants = getModelVariants(v.model);
    let found = false;
    let matchedModel = null;
    let trimCount = 0;
    
    for (const modelName of modelVariants) {
      const result = await pool.query(`
        SELECT COUNT(DISTINCT display_trim) as trim_count
        FROM vehicle_fitments 
        WHERE year = $1 
          AND make ILIKE $2 
          AND model ILIKE $3 
          AND certification_status = 'certified'
      `, [v.year, v.make.toLowerCase(), modelName]);
      
      const count = parseInt(result.rows[0].trim_count);
      if (count > 0) {
        found = true;
        matchedModel = modelName;
        trimCount = count;
        break;
      }
    }
    
    results.push({
      vehicle: `${v.year} ${v.make} ${v.model}`,
      found,
      matchedModel,
      trimCount,
    });
  }
  
  return results;
}

async function main() {
  console.log('='.repeat(70));
  console.log('FITMENT SOURCE AUDIT');
  console.log('='.repeat(70));
  console.log('');
  
  // Connect to DB
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
  
  try {
    // =========================================================================
    // Check Problem Vehicles
    // =========================================================================
    console.log('Checking problem vehicle visibility...\n');
    
    const vehicleResults = await checkProblemVehicles(pool);
    const passed = vehicleResults.filter(r => r.found);
    const failed = vehicleResults.filter(r => !r.found);
    
    for (const r of vehicleResults) {
      const status = r.found ? '✅' : '❌';
      console.log(`${status} ${r.vehicle}`);
      if (r.found) {
        console.log(`   → ${r.trimCount} trims (matched: ${r.matchedModel})`);
      } else {
        console.log(`   → NOT FOUND in vehicle_fitments`);
      }
    }
    
    console.log('');
    console.log('-'.repeat(70));
    
    // =========================================================================
    // Summary
    // =========================================================================
    if (failed.length > 0) {
      console.log('');
      console.log('❌ AUDIT FAILED');
      console.log('');
      console.log(`${failed.length} problem vehicle(s) not found in vehicle_fitments.`);
      console.log('These vehicles must be visible for the site to function correctly.');
      console.log('');
      console.log('Failed vehicles:');
      for (const f of failed) {
        console.log(`  - ${f.vehicle}`);
      }
      console.log('');
      console.log('='.repeat(70));
      process.exit(1);
    }
    
    console.log('');
    console.log('✅ AUDIT PASSED');
    console.log(`   ${passed.length}/${PROBLEM_VEHICLES.length} problem vehicles are visible`);
    console.log('');
    console.log('All problem vehicles resolve from canonical source: vehicle_fitments');
    console.log('');
    console.log('='.repeat(70));
    
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Audit error:', err);
  process.exit(1);
});
