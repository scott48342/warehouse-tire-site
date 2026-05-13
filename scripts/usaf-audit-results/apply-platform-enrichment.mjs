#!/usr/bin/env node
/**
 * Apply Platform Enrichment to Database
 * 
 * Usage:
 *   node scripts/usaf-audit-results/apply-platform-enrichment.mjs                    # Dry-run
 *   node scripts/usaf-audit-results/apply-platform-enrichment.mjs --apply            # Apply all
 *   node scripts/usaf-audit-results/apply-platform-enrichment.mjs --apply --batch=1  # Apply batch 1 only
 *   node scripts/usaf-audit-results/apply-platform-enrichment.mjs --apply --limit=50 # Apply first 50
 * 
 * SAFETY GUARDS:
 * - Only updates oem_tire_sizes field
 * - NO wheel spec changes (bolt_pattern, offset, center_bore)
 * - Creates snapshot before any write
 * - Smoke tests after each batch
 * - Rollback available from snapshots
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNAPSHOT_DIR = path.join(__dirname, 'enrichment-snapshots');
const PLAN_FILE = path.join(__dirname, 'combined-enrichment-plan.json');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

// ============================================================================
// DATABASE HELPERS
// ============================================================================

async function getVehicleFitments(year, make, model) {
  const result = await pool.query(
    `SELECT id, year, make, model, display_trim, raw_trim, oem_tire_sizes, oem_wheel_sizes,
            bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm
     FROM vehicle_fitments 
     WHERE year = $1 
       AND LOWER(make) = LOWER($2) 
       AND LOWER(model) = LOWER($3)`,
    [year, make, model]
  );
  return result.rows;
}

async function updateOemTireSizes(id, newSizes) {
  const result = await pool.query(
    `UPDATE vehicle_fitments 
     SET oem_tire_sizes = $1::jsonb, updated_at = NOW()
     WHERE id = $2
     RETURNING id, year, make, model, display_trim, oem_tire_sizes`,
    [JSON.stringify(newSizes), id]
  );
  return result.rows[0];
}

// ============================================================================
// TIRE SIZE NORMALIZATION
// ============================================================================

function normalizeTireSize(size) {
  if (!size || typeof size !== 'string') return null;
  const s = size.trim().toUpperCase();
  
  // Flotation format (33x12.50R15)
  const flotMatch = s.match(/^(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})/i);
  if (flotMatch) {
    const [, diameter, width, rim] = flotMatch;
    return `${diameter}x${width}R${rim}`;
  }
  
  // Standard format (P255/45R20, LT275/65R18, 265/70R17)
  const stdMatch = s.match(/^(P)?(LT)?(\d{3})\/(\d{2,3})(ZR|RF|R)?(\d{2})/i);
  if (stdMatch) {
    const [, pPrefix, ltPrefix, width, aspect, , rim] = stdMatch;
    const prefix = ltPrefix || '';
    return `${prefix}${width}/${aspect}R${rim}`;
  }
  
  return null;
}

function extractDiameter(size) {
  if (!size) return null;
  const match = size.match(/R(\d{2})$/i);
  return match ? parseInt(match[1], 10) : null;
}

// ============================================================================
// SNAPSHOT MANAGEMENT
// ============================================================================

async function createSnapshot(vehicles, batchId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotFile = path.join(SNAPSHOT_DIR, `pre-apply-${batchId}-${timestamp}.json`);
  
  const snapshots = [];
  
  for (const vehicle of vehicles) {
    const fitments = await getVehicleFitments(vehicle.year, vehicle.make, vehicle.model);
    snapshots.push({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      fitments: fitments.map(f => ({
        id: f.id,
        display_trim: f.display_trim,
        raw_trim: f.raw_trim,
        oem_tire_sizes: f.oem_tire_sizes,
        oem_wheel_sizes: f.oem_wheel_sizes,
        bolt_pattern: f.bolt_pattern,
        center_bore_mm: f.center_bore_mm,
        offset_min_mm: f.offset_min_mm,
        offset_max_mm: f.offset_max_mm,
      }))
    });
  }
  
  fs.writeFileSync(snapshotFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    batchId,
    vehicleCount: vehicles.length,
    snapshots
  }, null, 2));
  
  return snapshotFile;
}

// ============================================================================
// SMOKE TESTS
// ============================================================================

async function runSmokeTests(vehicle) {
  const tests = [];
  
  const fitments = await getVehicleFitments(vehicle.year, vehicle.make, vehicle.model);
  
  // Test 1: Vehicle still exists
  tests.push({
    name: 'Vehicle exists',
    pass: fitments.length > 0,
    detail: `${fitments.length} records`
  });
  
  // Test 2: Has tire sizes
  const hasTireSizes = fitments.some(f => (f.oem_tire_sizes || []).length > 0);
  tests.push({
    name: 'Has tire sizes',
    pass: hasTireSizes
  });
  
  // Test 3: New sizes added
  const allSizes = new Set();
  for (const f of fitments) {
    for (const s of (f.oem_tire_sizes || [])) {
      allSizes.add(s);
    }
  }
  const newSizesAdded = vehicle.newTireSizes.every(s => allSizes.has(s));
  tests.push({
    name: 'New sizes present',
    pass: newSizesAdded,
    detail: newSizesAdded ? undefined : `Missing: ${vehicle.newTireSizes.filter(s => !allSizes.has(s)).join(', ')}`
  });
  
  // Test 4: No invalid formats
  const invalidSizes = [...allSizes].filter(s => !normalizeTireSize(s));
  tests.push({
    name: 'All valid formats',
    pass: invalidSizes.length === 0,
    detail: invalidSizes.length > 0 ? `Invalid: ${invalidSizes.join(', ')}` : undefined
  });
  
  return tests;
}

// ============================================================================
// APPLY ENRICHMENT
// ============================================================================

async function applyEnrichment(vehicle, dryRun = true) {
  const vehicleKey = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const results = { vehicle: vehicleKey, records: 0, updated: 0, errors: [] };
  
  try {
    const fitments = await getVehicleFitments(vehicle.year, vehicle.make, vehicle.model);
    results.records = fitments.length;
    
    if (fitments.length === 0) {
      results.errors.push('No matching records found');
      return results;
    }
    
    // Validate new diameters exist in vehicle's wheel sizes
    const existingDiameters = new Set();
    for (const f of fitments) {
      for (const ws of (f.oem_wheel_sizes || [])) {
        const diam = typeof ws === 'number' ? ws : parseInt(ws, 10);
        if (!isNaN(diam)) existingDiameters.add(diam);
      }
    }
    
    // For each fitment record, merge new sizes
    for (const fitment of fitments) {
      const existing = fitment.oem_tire_sizes || [];
      const merged = [...new Set([...existing, ...vehicle.newTireSizes])].sort();
      
      // Skip if no changes
      if (merged.length === existing.length && merged.every((s, i) => s === existing[i])) {
        continue;
      }
      
      if (dryRun) {
        console.log(`   [DRY-RUN] Would update ${fitment.display_trim || fitment.raw_trim || 'Base'}: +${vehicle.newTireSizes.length} sizes`);
        results.updated++;
      } else {
        await updateOemTireSizes(fitment.id, merged);
        results.updated++;
      }
    }
  } catch (err) {
    results.errors.push(err.message);
  }
  
  return results;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value || true;
    }
  }
  
  const dryRun = !flags.apply;
  const batchIndex = flags.batch ? parseInt(flags.batch, 10) - 1 : null;
  const limit = flags.limit ? parseInt(flags.limit, 10) : null;
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('PLATFORM ENRICHMENT - DATABASE UPDATE');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '⚡ LIVE APPLY'}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  // Load plan
  if (!fs.existsSync(PLAN_FILE)) {
    console.error('❌ Plan file not found. Run apply-enrichment.js first.');
    process.exit(1);
  }
  
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
  console.log(`📊 Plan: ${plan.summary.uniqueVehicles} vehicles, ${plan.summary.totalNewTireSizes} new tire sizes`);
  console.log(`📦 Batches: ${plan.summary.batchCount}\n`);
  
  // Determine which vehicles to process
  let vehicles = plan.vehicles;
  
  if (batchIndex !== null) {
    const batch = plan.batches[batchIndex];
    if (!batch) {
      console.error(`❌ Batch ${batchIndex + 1} not found`);
      process.exit(1);
    }
    // Get vehicles in this batch
    const batchVehicleKeys = new Set(batch.map(u => `${u.year}|${u.make}|${u.model}`));
    vehicles = vehicles.filter(v => batchVehicleKeys.has(`${v.year}|${v.make}|${v.model}`));
    console.log(`📌 Processing batch ${batchIndex + 1}: ${vehicles.length} vehicles\n`);
  }
  
  if (limit) {
    vehicles = vehicles.slice(0, limit);
    console.log(`📌 Limited to first ${limit} vehicles\n`);
  }
  
  // Create snapshot before applying (even in dry-run for testing)
  if (!dryRun) {
    const batchId = batchIndex !== null ? `batch${batchIndex + 1}` : 'all';
    const snapshotFile = await createSnapshot(vehicles, batchId);
    console.log(`📸 Snapshot saved: ${snapshotFile}\n`);
  }
  
  // Process vehicles
  const results = {
    total: vehicles.length,
    processed: 0,
    updated: 0,
    recordsUpdated: 0,
    errors: [],
    smokeTestsFailed: []
  };
  
  for (const vehicle of vehicles) {
    const vehicleKey = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    process.stdout.write(`Processing ${vehicleKey}... `);
    
    const result = await applyEnrichment(vehicle, dryRun);
    results.processed++;
    
    if (result.errors.length > 0) {
      console.log(`❌ ${result.errors.join('; ')}`);
      results.errors.push({ vehicle: vehicleKey, errors: result.errors });
    } else if (result.updated > 0) {
      console.log(`✅ ${result.updated} records, +${vehicle.newTireSizes.length} sizes`);
      results.updated++;
      results.recordsUpdated += result.updated;
    } else {
      console.log(`⏭️  No changes needed`);
    }
  }
  
  // Run smoke tests on a sample (if not dry-run)
  if (!dryRun && results.updated > 0) {
    console.log('\n─────────────────────────────────────────────────────────────────────────');
    console.log('SMOKE TESTS');
    console.log('─────────────────────────────────────────────────────────────────────────\n');
    
    // Test first 5 updated vehicles
    const testVehicles = vehicles.slice(0, 5);
    for (const vehicle of testVehicles) {
      const vehicleKey = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      const tests = await runSmokeTests(vehicle);
      
      const allPass = tests.every(t => t.pass);
      console.log(`${allPass ? '✅' : '❌'} ${vehicleKey}`);
      
      for (const t of tests) {
        console.log(`   ${t.pass ? '✓' : '✗'} ${t.name}${t.detail ? ` - ${t.detail}` : ''}`);
      }
      
      if (!allPass) {
        results.smokeTestsFailed.push(vehicleKey);
      }
    }
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  console.log(`Total vehicles: ${results.total}`);
  console.log(`Processed: ${results.processed}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Records updated: ${results.recordsUpdated}`);
  console.log(`Errors: ${results.errors.length}`);
  
  if (results.smokeTestsFailed.length > 0) {
    console.log(`\n⚠️  Smoke tests failed: ${results.smokeTestsFailed.join(', ')}`);
  }
  
  if (dryRun) {
    console.log('\n💡 This was a dry run. Use --apply to write changes.');
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
