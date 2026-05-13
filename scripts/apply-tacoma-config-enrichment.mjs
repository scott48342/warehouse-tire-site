#!/usr/bin/env node
/**
 * Apply Config-Table Enrichment: 2024 Toyota Tacoma
 * 
 * APPROVED: 2 sizes only
 * - 265/70R17
 * - 265/70R18
 * 
 * Requirements:
 * - Insert into vehicle_fitment_configurations
 * - axle_position = 'all'
 * - is_optional = true
 * - is_default = false
 * - source = 'usaf_enrichment'
 * - source_confidence = 100
 * - No changes to existing rows
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

const VEHICLE = {
  year: 2024,
  make: 'Toyota',
  model: 'Tacoma',
  makeKey: 'toyota',
  modelKey: 'tacoma',
};

const SIZES_TO_ADD = [
  { tireSize: '265/70R17', wheelDiameter: 17 },
  { tireSize: '265/70R18', wheelDiameter: 18 },
];

const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');

function generateId() {
  return crypto.randomUUID();
}

async function getExistingConfigs() {
  const result = await pool.query(`
    SELECT id, tire_size, wheel_diameter, display_trim, axle_position, is_default, is_optional
    FROM vehicle_fitment_configurations
    WHERE year = $1 AND make_key = $2 AND model_key = $3
    ORDER BY wheel_diameter, tire_size
  `, [VEHICLE.year, VEHICLE.makeKey, VEHICLE.modelKey]);
  return result.rows;
}

async function checkDuplicates() {
  const existing = await getExistingConfigs();
  const existingSizes = new Set(existing.map(r => r.tire_size));
  
  const duplicates = SIZES_TO_ADD.filter(s => existingSizes.has(s.tireSize));
  return duplicates;
}

async function insertConfigs() {
  const inserted = [];
  const errors = [];
  
  for (const size of SIZES_TO_ADD) {
    const id = generateId();
    const configKey = `${VEHICLE.year}_${VEHICLE.makeKey}_${VEHICLE.modelKey}_usaf_${size.tireSize.replace(/\//g, '_')}`;
    const configLabel = `${VEHICLE.year} ${VEHICLE.make} ${VEHICLE.model} - ${size.tireSize} (USAF Enrichment)`;
    
    try {
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] Would insert: ${size.tireSize} (${size.wheelDiameter}")`);
        inserted.push({ id, ...size, dryRun: true });
      } else {
        await pool.query(`
          INSERT INTO vehicle_fitment_configurations (
            id,
            year,
            make_key,
            model_key,
            modification_id,
            display_trim,
            configuration_key,
            configuration_label,
            wheel_diameter,
            wheel_width,
            wheel_offset_mm,
            tire_size,
            axle_position,
            is_default,
            is_optional,
            source,
            source_confidence,
            source_notes,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
          )
        `, [
          id,
          VEHICLE.year,
          VEHICLE.makeKey,
          VEHICLE.modelKey,
          null,           // modification_id
          null,           // display_trim (applies to all trims)
          configKey,
          configLabel,
          size.wheelDiameter,
          null,           // wheel_width
          null,           // wheel_offset_mm
          size.tireSize,
          'all',          // axle_position
          false,          // is_default
          true,           // is_optional
          'usaf_enrichment',
          'high',         // source_confidence (text field)
          'USAF enrichment approved 2026-05-13. Confidence: 100%',
        ]);
        
        console.log(`  ✅ Inserted: ${size.tireSize} (${size.wheelDiameter}") - ID: ${id}`);
        inserted.push({ id, ...size });
      }
    } catch (err) {
      console.log(`  ❌ Failed: ${size.tireSize} - ${err.message}`);
      errors.push({ size: size.tireSize, error: err.message });
    }
  }
  
  return { inserted, errors };
}

async function verifyInsertion() {
  const result = await pool.query(`
    SELECT id, tire_size, wheel_diameter, axle_position, is_optional, source, source_confidence
    FROM vehicle_fitment_configurations
    WHERE year = $1 AND make_key = $2 AND model_key = $3
      AND source = 'usaf_enrichment'
    ORDER BY wheel_diameter, tire_size
  `, [VEHICLE.year, VEHICLE.makeKey, VEHICLE.modelKey]);
  return result.rows;
}

async function generateRollbackSQL(insertedIds) {
  const idList = insertedIds.map(id => `'${id}'`).join(', ');
  return `
-- ROLLBACK: 2024 Toyota Tacoma Config Enrichment
-- Run this to undo the enrichment

DELETE FROM vehicle_fitment_configurations
WHERE id IN (${idList});

-- Verify deletion
SELECT COUNT(*) as remaining
FROM vehicle_fitment_configurations
WHERE year = 2024 AND make_key = 'toyota' AND model_key = 'tacoma'
  AND source = 'usaf_enrichment';
`;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('CONFIG-TABLE ENRICHMENT: 2024 Toyota Tacoma');
  console.log('═'.repeat(70));
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : APPLY ? 'APPLY' : 'PREVIEW'}`);
  console.log('');
  
  // Step 1: Show current state
  console.log('📋 CURRENT CONFIG TABLE STATE');
  console.log('─'.repeat(70));
  const existing = await getExistingConfigs();
  console.log(`  Total rows: ${existing.length}`);
  const existingSizes = [...new Set(existing.map(r => r.tire_size))];
  console.log(`  Unique sizes: ${existingSizes.join(', ')}`);
  const existingDiameters = [...new Set(existing.map(r => r.wheel_diameter))].sort((a,b) => a-b);
  console.log(`  Diameters: ${existingDiameters.map(d => `${d}"`).join(', ')}`);
  console.log('');
  
  // Step 2: Check for duplicates
  console.log('🔍 DUPLICATE CHECK');
  console.log('─'.repeat(70));
  const duplicates = await checkDuplicates();
  if (duplicates.length > 0) {
    console.log(`  ❌ Found ${duplicates.length} duplicates - ABORTING`);
    for (const d of duplicates) {
      console.log(`     - ${d.tireSize} already exists`);
    }
    await pool.end();
    process.exit(1);
  }
  console.log('  ✅ No duplicates - safe to proceed');
  console.log('');
  
  // Step 3: Show what will be inserted
  console.log('📝 ROWS TO INSERT');
  console.log('─'.repeat(70));
  for (const size of SIZES_TO_ADD) {
    console.log(`  + ${size.tireSize} (${size.wheelDiameter}")`);
    console.log(`    axle_position: all`);
    console.log(`    is_optional: true`);
    console.log(`    is_default: false`);
    console.log(`    source: usaf_enrichment`);
    console.log(`    source_confidence: high (100%)`);
  }
  console.log('');
  
  if (!DRY_RUN && !APPLY) {
    console.log('─'.repeat(70));
    console.log('Run with --dry-run to preview or --apply to execute');
    await pool.end();
    return;
  }
  
  // Step 4: Insert
  console.log('⚙️  EXECUTING');
  console.log('─'.repeat(70));
  const { inserted, errors } = await insertConfigs();
  console.log('');
  
  if (errors.length > 0) {
    console.log(`❌ ${errors.length} errors occurred`);
    await pool.end();
    process.exit(1);
  }
  
  if (DRY_RUN) {
    console.log('─'.repeat(70));
    console.log('[DRY-RUN] No changes made. Run with --apply to execute.');
    await pool.end();
    return;
  }
  
  // Step 5: Verify
  console.log('✅ VERIFICATION');
  console.log('─'.repeat(70));
  const verified = await verifyInsertion();
  console.log(`  USAF enrichment rows: ${verified.length}`);
  for (const row of verified) {
    console.log(`    - ${row.tire_size} (${row.wheel_diameter}") [${row.id.slice(0,8)}...]`);
  }
  
  // Step 6: Final state
  console.log('');
  console.log('📊 FINAL STATE');
  console.log('─'.repeat(70));
  const finalState = await getExistingConfigs();
  console.log(`  Total rows: ${finalState.length} (was ${existing.length})`);
  const finalSizes = [...new Set(finalState.map(r => r.tire_size))];
  console.log(`  Unique sizes: ${finalSizes.length} (was ${existingSizes.length})`);
  const finalDiameters = [...new Set(finalState.map(r => r.wheel_diameter))].sort((a,b) => a-b);
  console.log(`  Diameters: ${finalDiameters.map(d => `${d}"`).join(', ')}`);
  
  // Step 7: Generate rollback SQL
  console.log('');
  console.log('🔙 ROLLBACK SQL');
  console.log('─'.repeat(70));
  const rollbackSQL = await generateRollbackSQL(inserted.map(i => i.id));
  console.log(rollbackSQL);
  
  // Save rollback SQL to file
  const fs = await import('fs');
  const rollbackPath = 'scripts/usaf-audit-results/tacoma-config-rollback.sql';
  fs.writeFileSync(rollbackPath, rollbackSQL);
  console.log(`📁 Rollback SQL saved to: ${rollbackPath}`);
  
  console.log('');
  console.log('═'.repeat(70));
  console.log('✅ ENRICHMENT COMPLETE');
  console.log('═'.repeat(70));
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
