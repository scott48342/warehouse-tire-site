#!/usr/bin/env node
/**
 * SAFE MODEL NAME NORMALIZATION
 * 
 * Normalizes vehicle model names to canonical display format.
 * Includes backup, conflict detection, and validation.
 * 
 * @created 2026-06-12
 */
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// =============================================================================
// NORMALIZATION MAPPINGS
// =============================================================================

const MODEL_MAPPINGS = [
  // RAM trucks - "1500" → "Ram 1500"
  { make: 'ram', from: '1500', to: 'Ram 1500' },
  { make: 'ram', from: '2500', to: 'Ram 2500' },
  { make: 'ram', from: '3500', to: 'Ram 3500' },
  
  // Chevrolet - kebab-case → Title Case
  { make: 'chevrolet', from: 'silverado-1500', to: 'Silverado 1500' },
  { make: 'chevrolet', from: 'silverado-2500hd', to: 'Silverado 2500HD' },
  { make: 'chevrolet', from: 'silverado-3500hd', to: 'Silverado 3500HD' },
  { make: 'chevrolet', from: 'silverado-2500-hd', to: 'Silverado 2500HD' },
  { make: 'chevrolet', from: 'silverado-3500-hd', to: 'Silverado 3500HD' },
  { make: 'chevrolet', from: 'silverado 2500 hd', to: 'Silverado 2500HD' },
  { make: 'chevrolet', from: 'Silverado 2500 HD', to: 'Silverado 2500HD' },
  { make: 'chevrolet', from: 'Silverado 3500 HD', to: 'Silverado 3500HD' },
  
  // GMC - kebab-case → Title Case  
  { make: 'gmc', from: 'sierra-1500', to: 'Sierra 1500' },
  { make: 'gmc', from: 'sierra-2500hd', to: 'Sierra 2500HD' },
  { make: 'gmc', from: 'sierra-3500hd', to: 'Sierra 3500HD' },
  { make: 'gmc', from: 'sierra-2500-hd', to: 'Sierra 2500HD' },
  { make: 'gmc', from: 'sierra-3500-hd', to: 'Sierra 3500HD' },
  { make: 'gmc', from: 'Sierra 2500 HD', to: 'Sierra 2500HD' },
  { make: 'gmc', from: 'Sierra 3500 HD', to: 'Sierra 3500HD' },
  
  // Hyundai
  { make: 'hyundai', from: 'santa-fe', to: 'Santa Fe' },
];

// =============================================================================
// MAIN MIGRATION
// =============================================================================

async function runMigration() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(__dirname, 'backups');
  mkdirSync(backupDir, { recursive: true });
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('MODEL NAME NORMALIZATION MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Timestamp: ${timestamp}\n`);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: PRE-MIGRATION COVERAGE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('STEP 1: PRE-MIGRATION COVERAGE');
  console.log('──────────────────────────────────');
  const preCoverage = await calculateTier1Coverage();
  console.log(`  Tier 1: ${preCoverage.populated}/${preCoverage.total} (${preCoverage.percent}%)\n`);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: COUNT AFFECTED ROWS PER MAPPING
  // ─────────────────────────────────────────────────────────────────────────
  console.log('STEP 2: AFFECTED ROWS PER MAPPING');
  console.log('──────────────────────────────────');
  
  const affectedCounts = [];
  for (const mapping of MODEL_MAPPINGS) {
    const count = await sql`
      SELECT COUNT(*) as cnt 
      FROM vehicle_fitments 
      WHERE LOWER(make) = ${mapping.make}
        AND LOWER(model) = ${mapping.from.toLowerCase()}
    `;
    const cnt = Number(count[0].cnt);
    if (cnt > 0) {
      affectedCounts.push({ ...mapping, count: cnt });
      console.log(`  ${mapping.make}/${mapping.from} → ${mapping.to}: ${cnt} rows`);
    }
  }
  
  const totalAffected = affectedCounts.reduce((sum, m) => sum + m.count, 0);
  console.log(`  ─────────────────────`);
  console.log(`  TOTAL: ${totalAffected} rows\n`);
  
  if (totalAffected === 0) {
    console.log('  No rows to update. Exiting.');
    await sql.end();
    return;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: CHECK FOR DUPLICATE CONFLICTS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('STEP 3: CHECKING FOR DUPLICATE CONFLICTS');
  console.log('─────────────────────────────────────────');
  
  let hasConflicts = false;
  for (const mapping of affectedCounts) {
    // Check if target model name already has records for same year
    const conflicts = await sql`
      SELECT vf1.year, vf1.display_trim, COUNT(*) as conflict_count
      FROM vehicle_fitments vf1
      WHERE LOWER(vf1.make) = ${mapping.make}
        AND LOWER(vf1.model) = ${mapping.from.toLowerCase()}
        AND EXISTS (
          SELECT 1 FROM vehicle_fitments vf2
          WHERE LOWER(vf2.make) = ${mapping.make}
            AND LOWER(vf2.model) = ${mapping.to.toLowerCase()}
            AND vf2.year = vf1.year
            AND LOWER(COALESCE(vf2.display_trim, '')) = LOWER(COALESCE(vf1.display_trim, ''))
        )
      GROUP BY vf1.year, vf1.display_trim
    `;
    
    if (conflicts.length > 0) {
      hasConflicts = true;
      console.log(`  ⚠️  CONFLICT: ${mapping.make}/${mapping.from} → ${mapping.to}`);
      conflicts.forEach(c => {
        console.log(`      Year ${c.year}, Trim "${c.display_trim}": ${c.conflict_count} duplicates`);
      });
    }
  }
  
  if (hasConflicts) {
    console.log('\n  ❌ CONFLICTS DETECTED - Will merge duplicates (keep first, update rest)\n');
  } else {
    console.log('  ✓ No conflicts detected\n');
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: BACKUP AFFECTED ROWS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('STEP 4: BACKING UP AFFECTED ROWS');
  console.log('─────────────────────────────────');
  
  const backupData = [];
  for (const mapping of affectedCounts) {
    const rows = await sql`
      SELECT * FROM vehicle_fitments 
      WHERE LOWER(make) = ${mapping.make}
        AND LOWER(model) = ${mapping.from.toLowerCase()}
    `;
    rows.forEach(r => backupData.push({ ...r, _mapping: mapping }));
  }
  
  const backupFile = join(backupDir, `model-normalization-backup-${timestamp}.json`);
  writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
  console.log(`  ✓ Backed up ${backupData.length} rows to:`);
  console.log(`    ${backupFile}\n`);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: PERFORM UPDATES
  // ─────────────────────────────────────────────────────────────────────────
  console.log('STEP 5: PERFORMING UPDATES');
  console.log('──────────────────────────');
  
  let totalUpdated = 0;
  let totalDeleted = 0;
  
  for (const mapping of affectedCounts) {
    // First, handle duplicates by deleting them (keep the canonical one)
    if (hasConflicts) {
      const deleted = await sql`
        DELETE FROM vehicle_fitments
        WHERE id IN (
          SELECT vf1.id
          FROM vehicle_fitments vf1
          WHERE LOWER(vf1.make) = ${mapping.make}
            AND LOWER(vf1.model) = ${mapping.from.toLowerCase()}
            AND EXISTS (
              SELECT 1 FROM vehicle_fitments vf2
              WHERE LOWER(vf2.make) = ${mapping.make}
                AND LOWER(vf2.model) = ${mapping.to.toLowerCase()}
                AND vf2.year = vf1.year
                AND LOWER(COALESCE(vf2.display_trim, '')) = LOWER(COALESCE(vf1.display_trim, ''))
            )
        )
      `;
      if (deleted.count > 0) {
        totalDeleted += deleted.count;
        console.log(`  Deleted ${deleted.count} duplicates for ${mapping.make}/${mapping.from}`);
      }
    }
    
    // Now update remaining rows
    const result = await sql`
      UPDATE vehicle_fitments 
      SET model = ${mapping.to},
          updated_at = NOW()
      WHERE LOWER(make) = ${mapping.make}
        AND LOWER(model) = ${mapping.from.toLowerCase()}
    `;
    
    totalUpdated += result.count;
    console.log(`  ✓ ${mapping.make}/${mapping.from} → ${mapping.to}: ${result.count} updated`);
  }
  
  console.log(`  ─────────────────────`);
  console.log(`  TOTAL: ${totalUpdated} updated, ${totalDeleted} duplicates removed\n`);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: POST-MIGRATION COVERAGE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('STEP 6: POST-MIGRATION COVERAGE');
  console.log('───────────────────────────────');
  const postCoverage = await calculateTier1Coverage();
  console.log(`  Tier 1: ${postCoverage.populated}/${postCoverage.total} (${postCoverage.percent}%)`);
  console.log(`  Change: ${preCoverage.percent}% → ${postCoverage.percent}% (+${postCoverage.percent - preCoverage.percent}%)\n`);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 7: VERIFY AFFECTED VEHICLES
  // ─────────────────────────────────────────────────────────────────────────
  console.log('STEP 7: VERIFYING AFFECTED VEHICLES');
  console.log('────────────────────────────────────');
  
  const verifyVehicles = [
    { make: 'RAM', model: 'Ram 1500', year: 2018 },
    { make: 'RAM', model: 'Ram 2500', year: 2020 },
    { make: 'RAM', model: 'Ram 3500', year: 2022 },
    { make: 'Chevrolet', model: 'Silverado 2500HD', year: 2020 },
    { make: 'Chevrolet', model: 'Silverado 3500HD', year: 2022 },
    { make: 'GMC', model: 'Sierra 2500HD', year: 2020 },
    { make: 'GMC', model: 'Sierra 3500HD', year: 2022 },
    { make: 'Hyundai', model: 'Santa Fe', year: 2023 },
  ];
  
  for (const v of verifyVehicles) {
    const record = await sql`
      SELECT id, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments
      WHERE LOWER(make) = ${v.make.toLowerCase()}
        AND LOWER(model) = ${v.model.toLowerCase()}
        AND year = ${v.year}
      LIMIT 1
    `;
    
    if (record.length > 0) {
      const r = record[0];
      const hasWheels = r.oem_wheel_sizes && JSON.parse(r.oem_wheel_sizes || '[]').length > 0;
      const hasTires = r.oem_tire_sizes && JSON.parse(r.oem_tire_sizes || '[]').length > 0;
      console.log(`  ✓ ${v.year} ${v.make} ${v.model}`);
      console.log(`    Bolt: ${r.bolt_pattern} | CB: ${r.center_bore_mm}mm | Wheels: ${hasWheels ? '✓' : '✗'} | Tires: ${hasTires ? '✓' : '✗'}`);
    } else {
      console.log(`  ✗ ${v.year} ${v.make} ${v.model} - NOT FOUND`);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 8: GENERATE SQL ROLLBACK
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nSTEP 8: GENERATING ROLLBACK SQL');
  console.log('────────────────────────────────');
  
  const rollbackStatements = MODEL_MAPPINGS.map(m => 
    `UPDATE vehicle_fitments SET model = '${m.from}' WHERE LOWER(make) = '${m.make}' AND LOWER(model) = '${m.to.toLowerCase()}';`
  ).join('\n');
  
  const rollbackFile = join(backupDir, `model-normalization-rollback-${timestamp}.sql`);
  writeFileSync(rollbackFile, `-- Rollback for model normalization ${timestamp}\n-- WARNING: Does not restore deleted duplicates\n\n${rollbackStatements}`);
  console.log(`  ✓ Rollback SQL saved to:`);
  console.log(`    ${rollbackFile}\n`);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('MIGRATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  
  await sql.end();
}

// =============================================================================
// TIER 1 COVERAGE CALCULATION
// =============================================================================

const TIER_1_VEHICLES = [
  { make: "Ford", model: "F-150" },
  { make: "Chevrolet", model: "Silverado 1500" },
  { make: "RAM", model: "Ram 1500" },
  { make: "GMC", model: "Sierra 1500" },
  { make: "Toyota", model: "Tundra" },
  { make: "Nissan", model: "Titan" },
  { make: "Toyota", model: "Tacoma" },
  { make: "Ford", model: "Ranger" },
  { make: "Chevrolet", model: "Colorado" },
  { make: "GMC", model: "Canyon" },
  { make: "Nissan", model: "Frontier" },
  { make: "Honda", model: "Ridgeline" },
  { make: "Jeep", model: "Gladiator" },
  { make: "Ford", model: "Maverick" },
  { make: "Ford", model: "F-250" },
  { make: "Ford", model: "F-350" },
  { make: "Chevrolet", model: "Silverado 2500HD" },
  { make: "Chevrolet", model: "Silverado 3500HD" },
  { make: "RAM", model: "Ram 2500" },
  { make: "RAM", model: "Ram 3500" },
  { make: "GMC", model: "Sierra 2500HD" },
  { make: "GMC", model: "Sierra 3500HD" },
  { make: "Toyota", model: "RAV4" },
  { make: "Honda", model: "CR-V" },
  { make: "Mazda", model: "CX-5" },
  { make: "Subaru", model: "Crosstrek" },
  { make: "Subaru", model: "Forester" },
  { make: "Hyundai", model: "Tucson" },
  { make: "Kia", model: "Sportage" },
  { make: "Nissan", model: "Rogue" },
  { make: "Ford", model: "Escape" },
  { make: "Chevrolet", model: "Equinox" },
  { make: "Toyota", model: "Highlander" },
  { make: "Honda", model: "Pilot" },
  { make: "Ford", model: "Explorer" },
  { make: "Chevrolet", model: "Traverse" },
  { make: "Hyundai", model: "Santa Fe" },
  { make: "Kia", model: "Sorento" },
  { make: "Subaru", model: "Outback" },
  { make: "Mazda", model: "CX-9" },
  { make: "Chevrolet", model: "Tahoe" },
  { make: "Chevrolet", model: "Suburban" },
  { make: "GMC", model: "Yukon" },
  { make: "Ford", model: "Expedition" },
  { make: "Toyota", model: "Sequoia" },
  { make: "Nissan", model: "Armada" },
  { make: "Jeep", model: "Wrangler" },
  { make: "Jeep", model: "Grand Cherokee" },
  { make: "Toyota", model: "4Runner" },
  { make: "Ford", model: "Bronco" },
  { make: "Land Rover", model: "Defender" },
];

const YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

async function calculateTier1Coverage() {
  const populated = await sql`
    SELECT DISTINCT year, LOWER(make) as make, LOWER(model) as model
    FROM vehicle_fitments
  `;
  
  const populatedSet = new Set(
    populated.map(v => `${v.year}|${v.make}|${v.model}`)
  );
  
  let total = 0;
  let found = 0;
  
  for (const vehicle of TIER_1_VEHICLES) {
    for (const year of YEARS) {
      const key = `${year}|${vehicle.make.toLowerCase()}|${vehicle.model.toLowerCase()}`;
      total++;
      if (populatedSet.has(key)) {
        found++;
      }
    }
  }
  
  return {
    total,
    populated: found,
    percent: Math.round((found / total) * 100)
  };
}

runMigration().catch(console.error);
