#!/usr/bin/env node
/**
 * USAF ENRICHMENT - POST-CONSOLIDATION
 * 
 * Applies ONLY safe auto-fixes to vehicle_fitments.oem_tire_sizes
 * 
 * Requirements (per Scott 2026-05-13):
 * - Ignores deprecated config table completely
 * - 100% confidence safe auto-fixes only
 * - No staggered ambiguity
 * - No HD/SRW/DRW ambiguity  
 * - No flotation/HL uncertainty
 * - No new wheel diameter conflicts
 * - No malformed size formats
 * 
 * Usage:
 *   node scripts/usaf-enrichment-consolidated.mjs --dry-run    # Preview only
 *   node scripts/usaf-enrichment-consolidated.mjs --apply      # Apply changes
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ════════════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════════════

const BATCH_FILES = [
  'batch-01.json', 'batch-02.json', 'batch-03.json', 'batch-04.json',
  'batch-05.json', 'batch-06.json', 'batch-07.json', 'batch-08.json',
  'batch-09.json', 'batch-10.json'
];

const RESULTS_DIR = join(__dirname, 'usaf-audit-results');
const SNAPSHOT_DIR = join(__dirname, 'usaf-enrichment-snapshots');

// Strict filtering criteria
const STRICT_FILTERS = {
  minConfidence: 100,
  allowStaggered: false,
  allowHDTruck: false,
  allowFlotation: false,
  allowHL: false,
  allowNewDiameter: false,
  allowMalformed: false,
};

// Malformed patterns to reject
const MALFORMED_PATTERNS = [
  /^\d{2,3}\/\d{2}R\d{2}C$/i,     // Commercial (e.g., 225/75R16C)
  /^\d{2,3}\/\d{2}R\d{2}LT$/i,    // LT suffix wrong position
  /^LT\d{2,3}\/\d{2}R\d{2}[A-Z]/i, // LT with extra suffix
  /HL$/i,                          // High Load
  /^\d{2}x/i,                      // Flotation format
];

// Valid P-metric/LT formats
const VALID_SIZE_PATTERN = /^(P|LT)?\d{3}\/\d{2}(Z)?R\d{2}$/;

// ════════════════════════════════════════════════════════════════════════════════
// DATABASE
// ════════════════════════════════════════════════════════════════════════════════

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

async function getVehicleFitments(year, make, model) {
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim, modification_id, 
           oem_tire_sizes, oem_wheel_sizes, certification_status
    FROM vehicle_fitments
    WHERE year = $1 
      AND LOWER(make) = LOWER($2)
      AND (LOWER(model) = LOWER($3) OR LOWER(model) = LOWER($4))
      AND certification_status = 'certified'
  `, [year, make, model, model.replace(/ /g, '-')]);
  
  return result.rows;
}

async function updateOemTireSizes(id, newSizes) {
  await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $1::jsonb,
        updated_at = NOW()
    WHERE id = $2
  `, [JSON.stringify(newSizes), id]);
}

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════════════════════════════════════════

function isValidSizeFormat(size) {
  if (!size || typeof size !== 'string') return false;
  
  // Check for malformed patterns
  for (const pattern of MALFORMED_PATTERNS) {
    if (pattern.test(size)) return false;
  }
  
  // Must match valid pattern
  return VALID_SIZE_PATTERN.test(size);
}

function extractDiameter(size) {
  const match = size?.match(/R(\d{2})$/);
  return match ? parseInt(match[1], 10) : null;
}

function normalizeOemTireSizes(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  
  return raw
    .filter(s => s && typeof s === 'string')
    .map(s => s.trim());
}

function passesStrictFilters(fix) {
  // Must be 100% confidence
  if (fix.confidence < STRICT_FILTERS.minConfidence) {
    return { pass: false, reason: `Confidence ${fix.confidence}% < 100%` };
  }
  
  // No staggered vehicles
  if (fix.vehicleFlags?.isStaggered && !STRICT_FILTERS.allowStaggered) {
    return { pass: false, reason: 'Staggered vehicle' };
  }
  
  // No HD trucks
  if (fix.vehicleFlags?.isHDTruck && !STRICT_FILTERS.allowHDTruck) {
    return { pass: false, reason: 'HD truck (SRW/DRW ambiguity)' };
  }
  
  // No flotation format
  if (/^\d{2}x/i.test(fix.tireSize) && !STRICT_FILTERS.allowFlotation) {
    return { pass: false, reason: 'Flotation format' };
  }
  
  // No HL format
  if (/HL$/i.test(fix.tireSize) && !STRICT_FILTERS.allowHL) {
    return { pass: false, reason: 'HL (High Load) format' };
  }
  
  // Must be valid P-metric or LT format
  if (!isValidSizeFormat(fix.tireSize)) {
    return { pass: false, reason: `Malformed size: ${fix.tireSize}` };
  }
  
  // Wheel diameter must exist
  const newDiameter = extractDiameter(fix.tireSize);
  if (!newDiameter) {
    return { pass: false, reason: 'Cannot extract diameter' };
  }
  
  // Must use existing wheel diameter (no new diameters)
  if (fix.existingDiameters && !fix.existingDiameters.includes(newDiameter)) {
    if (!STRICT_FILTERS.allowNewDiameter) {
      return { pass: false, reason: `New diameter ${newDiameter}" not in existing [${fix.existingDiameters.join(',')}]` };
    }
  }
  
  // Auto-reject flags from original audit
  if (fix.autoReject && fix.autoReject.length > 0) {
    return { pass: false, reason: `Auto-reject: ${fix.autoReject.join(', ')}` };
  }
  
  return { pass: true, reason: null };
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || !args.includes('--apply');
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('USAF ENRICHMENT - POST-CONSOLIDATION');
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : '🔴 APPLY MODE'}`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // ──────────────────────────────────────────────────────────────────────────────
  // PHASE 1: Load all safe auto-fixes from batches
  // ──────────────────────────────────────────────────────────────────────────────
  
  console.log('📁 Phase 1: Loading safe auto-fixes from batch files...');
  
  const allFixes = [];
  
  for (const batchFile of BATCH_FILES) {
    const filePath = join(RESULTS_DIR, batchFile);
    if (!existsSync(filePath)) {
      console.log(`   ⚠️  Missing: ${batchFile}`);
      continue;
    }
    
    const batch = JSON.parse(readFileSync(filePath, 'utf8'));
    if (batch.safeAutoFixes && Array.isArray(batch.safeAutoFixes)) {
      allFixes.push(...batch.safeAutoFixes);
    }
  }
  
  console.log(`   Found ${allFixes.length} raw safe auto-fixes`);
  console.log('');
  
  // ──────────────────────────────────────────────────────────────────────────────
  // PHASE 2: Apply strict filters
  // ──────────────────────────────────────────────────────────────────────────────
  
  console.log('🔍 Phase 2: Applying strict filters...');
  console.log('   Criteria:');
  console.log('   - 100% confidence only');
  console.log('   - No staggered vehicles');
  console.log('   - No HD/SRW/DRW trucks');
  console.log('   - No flotation format');
  console.log('   - No HL format');
  console.log('   - No new wheel diameters');
  console.log('   - Valid P-metric/LT format only');
  console.log('');
  
  const approved = [];
  const rejected = [];
  
  for (const fix of allFixes) {
    const { pass, reason } = passesStrictFilters(fix);
    if (pass) {
      approved.push(fix);
    } else {
      rejected.push({ ...fix, rejectReason: reason });
    }
  }
  
  console.log(`   ✅ Approved: ${approved.length}`);
  console.log(`   ❌ Rejected: ${rejected.length}`);
  console.log('');
  
  // Show rejection breakdown
  const rejectReasons = {};
  for (const r of rejected) {
    const reason = r.rejectReason || 'Unknown';
    rejectReasons[reason] = (rejectReasons[reason] || 0) + 1;
  }
  
  if (Object.keys(rejectReasons).length > 0) {
    console.log('   Rejection breakdown:');
    for (const [reason, count] of Object.entries(rejectReasons).sort((a,b) => b[1] - a[1])) {
      console.log(`     - ${reason}: ${count}`);
    }
    console.log('');
  }
  
  if (approved.length === 0) {
    console.log('⚠️  No approved fixes after strict filtering. Exiting.');
    process.exit(0);
  }
  
  // ──────────────────────────────────────────────────────────────────────────────
  // PHASE 3: Group by vehicle and dedupe
  // ──────────────────────────────────────────────────────────────────────────────
  
  console.log('📦 Phase 3: Grouping by vehicle...');
  
  const vehicleMap = new Map();
  
  for (const fix of approved) {
    const key = `${fix.year}|${fix.make}|${fix.model}`;
    if (!vehicleMap.has(key)) {
      vehicleMap.set(key, {
        year: fix.year,
        make: fix.make,
        model: fix.model,
        newSizes: new Set(),
        existingWtdSizes: new Set(fix.existingWtdSizes || []),
      });
    }
    vehicleMap.get(key).newSizes.add(fix.tireSize);
  }
  
  console.log(`   ${vehicleMap.size} unique vehicles`);
  console.log('');
  
  // ──────────────────────────────────────────────────────────────────────────────
  // PHASE 4: Query DB and compute diffs
  // ──────────────────────────────────────────────────────────────────────────────
  
  console.log('🗄️  Phase 4: Computing diffs against vehicle_fitments...');
  
  const updates = [];
  const snapshots = [];
  let totalNewSizes = 0;
  
  for (const [key, vehicle] of vehicleMap) {
    const fitments = await getVehicleFitments(vehicle.year, vehicle.make, vehicle.model);
    
    if (fitments.length === 0) {
      console.log(`   ⚠️  No fitments found: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      continue;
    }
    
    for (const fitment of fitments) {
      const existingSizes = normalizeOemTireSizes(fitment.oem_tire_sizes);
      const existingSet = new Set(existingSizes.map(s => s.toUpperCase()));
      
      // Find sizes to add (not already present)
      const sizesToAdd = [...vehicle.newSizes].filter(s => 
        !existingSet.has(s.toUpperCase())
      );
      
      if (sizesToAdd.length === 0) continue;
      
      const newSizes = [...existingSizes, ...sizesToAdd];
      
      // Create snapshot
      snapshots.push({
        id: fitment.id,
        year: fitment.year,
        make: fitment.make,
        model: fitment.model,
        displayTrim: fitment.display_trim,
        before: existingSizes,
        after: newSizes,
        added: sizesToAdd,
      });
      
      updates.push({
        id: fitment.id,
        year: fitment.year,
        make: fitment.make,
        model: fitment.model,
        displayTrim: fitment.display_trim,
        existingSizes,
        sizesToAdd,
        newSizes,
      });
      
      totalNewSizes += sizesToAdd.length;
    }
  }
  
  console.log(`   ${updates.length} fitment records to update`);
  console.log(`   ${totalNewSizes} total tire sizes to add`);
  console.log('');
  
  if (updates.length === 0) {
    console.log('⚠️  No updates needed - all sizes already present. Exiting.');
    process.exit(0);
  }
  
  // ──────────────────────────────────────────────────────────────────────────────
  // PHASE 5: Show diff preview
  // ──────────────────────────────────────────────────────────────────────────────
  
  console.log('📋 Phase 5: Diff preview (first 30 updates)...');
  console.log('');
  
  for (const update of updates.slice(0, 30)) {
    console.log(`   ${update.year} ${update.make} ${update.model} [${update.displayTrim}]`);
    console.log(`     + ${update.sizesToAdd.join(', ')}`);
  }
  
  if (updates.length > 30) {
    console.log(`   ... and ${updates.length - 30} more updates`);
  }
  console.log('');
  
  // ──────────────────────────────────────────────────────────────────────────────
  // PHASE 6: Save snapshot
  // ──────────────────────────────────────────────────────────────────────────────
  
  if (!existsSync(SNAPSHOT_DIR)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = join(SNAPSHOT_DIR, `snapshot-${timestamp}.json`);
  
  writeFileSync(snapshotPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'apply',
    stats: {
      totalFixes: allFixes.length,
      approvedFixes: approved.length,
      rejectedFixes: rejected.length,
      vehiclesAffected: vehicleMap.size,
      recordsToUpdate: updates.length,
      sizesToAdd: totalNewSizes,
    },
    snapshots,
  }, null, 2));
  
  console.log(`💾 Snapshot saved: ${snapshotPath}`);
  console.log('');
  
  // ──────────────────────────────────────────────────────────────────────────────
  // PHASE 7: Apply (if not dry-run)
  // ──────────────────────────────────────────────────────────────────────────────
  
  if (dryRun) {
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('DRY RUN COMPLETE - No changes applied');
    console.log('');
    console.log('To apply changes, run:');
    console.log('  node scripts/usaf-enrichment-consolidated.mjs --apply');
    console.log('═══════════════════════════════════════════════════════════════════════');
    
    await pool.end();
    return {
      dryRun: true,
      vehiclesUpdated: 0,
      sizesAdded: 0,
      approved: approved.length,
      rejected: rejected.length,
    };
  }
  
  console.log('🔴 Phase 7: Applying changes to vehicle_fitments...');
  
  let appliedCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    try {
      await updateOemTireSizes(update.id, update.newSizes);
      appliedCount++;
      
      if (appliedCount % 50 === 0) {
        console.log(`   Applied ${appliedCount}/${updates.length}...`);
      }
    } catch (err) {
      console.error(`   ❌ Error updating ${update.year} ${update.make} ${update.model}: ${err.message}`);
      errorCount++;
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('ENRICHMENT COMPLETE');
  console.log('');
  console.log(`   ✅ Records updated: ${appliedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📊 Tire sizes added: ${totalNewSizes}`);
  console.log(`   🚗 Vehicles affected: ${vehicleMap.size}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Run health check: curl localhost:3001/api/admin/fitment/health');
  console.log('  2. Run smoke tests: node scripts/prod-smoke-test.mjs');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  await pool.end();
  
  return {
    dryRun: false,
    vehiclesUpdated: vehicleMap.size,
    recordsUpdated: appliedCount,
    sizesAdded: totalNewSizes,
    approved: approved.length,
    rejected: rejected.length,
    errors: errorCount,
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
