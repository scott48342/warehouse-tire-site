#!/usr/bin/env node
/**
 * Delete 12 Fake BMW M3/M4 "Base" Records
 * 
 * APPROVED DELETE - Scott 2026-05-14
 * 
 * These records have fake modification_ids and aggregate tire sizes
 * that bypass the resolver's fallback logic.
 */

import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

// EXACT 12 IDs to delete - verified from list-fake-bmw.mjs
const IDS_TO_DELETE = [
  'e90e7a4f-3130-4979-9f77-eb8eb42a6c50', // 2026 M3
  'b0f7da13-cc81-46aa-b87f-2c21a333c58d', // 2026 M4
  '884b5634-6a54-47de-ad93-22af15dd558c', // 2025 M3
  'e2473bfb-26a8-4f05-843c-f985411bab6d', // 2025 M4
  '0bfaf56d-acee-439c-a582-6d8cd2632d2f', // 2024 M3
  '62a27692-bf38-40c0-ae1d-e25c03d058e7', // 2024 M4
  'f438318f-0abf-4b75-b2e4-489b436e34b0', // 2023 M3
  'd995f8eb-bf02-4e93-9e1c-db67faf756d3', // 2023 M4
  '429b7ca1-dccd-4471-b44a-5b25364c7de4', // 2022 M3
  '2c73884b-3261-49bc-bd36-933b1d58a28d', // 2022 M4
  '46aaa324-876a-4649-a74b-8d720155095a', // 2021 M3
  'f744fd9f-8651-4787-94fb-439437cb76f4', // 2021 M4
];

const SNAPSHOT_DIR = './scripts/bmw-delete-snapshots';

async function main() {
  console.log('=' .repeat(70));
  console.log(' DELETE FAKE BMW M3/M4 "Base" RECORDS');
  console.log(' Approved: 2026-05-14');
  console.log('=' .repeat(70));
  console.log();

  // Ensure snapshot dir exists
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  // ===== PHASE 1: SNAPSHOT =====
  console.log('📸 Phase 1: Creating snapshot of records to delete...\n');

  const recordsToDelete = await sql`
    SELECT * FROM vehicle_fitments WHERE id = ANY(${IDS_TO_DELETE})
  `;

  if (recordsToDelete.length !== 12) {
    console.error(`❌ Expected 12 records, found ${recordsToDelete.length}`);
    console.log('IDs found:', recordsToDelete.map(r => r.id));
    console.log('IDs expected:', IDS_TO_DELETE);
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(SNAPSHOT_DIR, `snapshot-${timestamp}.json`);
  
  fs.writeFileSync(snapshotPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    reason: 'Delete fake BMW M3/M4 Base records with fake modification_ids',
    approval: 'Scott 2026-05-14',
    recordCount: recordsToDelete.length,
    records: recordsToDelete
  }, null, 2));

  console.log(`   ✅ Snapshot saved: ${snapshotPath}`);
  console.log(`   Records to delete: ${recordsToDelete.length}`);
  console.log();

  for (const r of recordsToDelete) {
    console.log(`   - ${r.year} BMW ${r.model} "${r.display_trim}" (${r.source})`);
  }
  console.log();

  // ===== PHASE 2: DELETE =====
  console.log('🗑️  Phase 2: Deleting records...\n');

  const deleteResult = await sql`
    DELETE FROM vehicle_fitments 
    WHERE id = ANY(${IDS_TO_DELETE})
    RETURNING id
  `;

  console.log(`   ✅ Deleted ${deleteResult.length} records\n`);

  // ===== PHASE 3: VERIFY REAL TRIMS REMAIN =====
  console.log('✅ Phase 3: Verifying real trims remain...\n');

  const realTrims = await sql`
    SELECT year, model, display_trim, modification_id, source
    FROM vehicle_fitments 
    WHERE make ILIKE 'BMW' 
      AND (model ILIKE 'M3' OR model ILIKE 'M4')
      AND year >= 2021
    ORDER BY year DESC, model, display_trim
  `;

  const byYearModel = {};
  for (const r of realTrims) {
    const key = `${r.year} ${r.model}`;
    if (!byYearModel[key]) byYearModel[key] = [];
    byYearModel[key].push(r.display_trim);
  }

  console.log('   Remaining BMW M3/M4 trims by year:\n');
  for (const [ym, trims] of Object.entries(byYearModel).sort()) {
    console.log(`   ${ym}: ${trims.join(', ')}`);
  }
  console.log();

  // Check for required trims
  const expectedTrims = {
    'M3': ['M3', 'M3 Competition', 'Competition', 'Competition xDrive'],
    'M4': ['M4', 'Competition', 'Competition xDrive', 'CS']
  };

  let hasIssues = false;
  for (const year of [2021, 2022, 2023, 2024, 2025, 2026]) {
    for (const model of ['M3', 'M4']) {
      const key = `${year} ${model}`;
      const trims = byYearModel[key] || [];
      const hasCompetition = trims.some(t => t.includes('Competition'));
      
      if (trims.length === 0) {
        console.log(`   ⚠️  ${key}: No trims found!`);
        hasIssues = true;
      } else if (!hasCompetition) {
        console.log(`   ⚠️  ${key}: Missing Competition trim`);
        hasIssues = true;
      }
    }
  }

  if (!hasIssues) {
    console.log('   ✅ All years have real trims (Competition variants present)\n');
  }

  // ===== PHASE 4: VERIFY NO "BASE" REMAINS =====
  console.log('🔍 Phase 4: Verifying no fake "Base" remains...\n');

  const baseCheck = await sql`
    SELECT id, year, model, display_trim, modification_id
    FROM vehicle_fitments 
    WHERE make ILIKE 'BMW' 
      AND (model ILIKE 'M3' OR model ILIKE 'M4')
      AND display_trim = 'Base'
      AND year >= 2021
  `;

  if (baseCheck.length === 0) {
    console.log('   ✅ No "Base" trim records found for M3/M4 2021-2026\n');
  } else {
    console.log(`   ⚠️  Found ${baseCheck.length} remaining Base records:`);
    for (const r of baseCheck) {
      console.log(`      - ${r.year} ${r.model} (${r.modification_id})`);
    }
    console.log();
  }

  // ===== SUMMARY =====
  console.log('=' .repeat(70));
  console.log(' SUMMARY');
  console.log('=' .repeat(70));
  console.log(`   Deleted records:      ${deleteResult.length}`);
  console.log(`   Remaining M3 trims:   ${Object.entries(byYearModel).filter(([k]) => k.includes('M3')).length} year-trim combos`);
  console.log(`   Remaining M4 trims:   ${Object.entries(byYearModel).filter(([k]) => k.includes('M4')).length} year-trim combos`);
  console.log(`   Rollback snapshot:    ${snapshotPath}`);
  console.log();

  // Return structured result
  return {
    deletedCount: deleteResult.length,
    snapshotPath,
    remainingTrims: byYearModel,
    baseRemaining: baseCheck.length
  };
}

main()
  .then(result => {
    console.log('📊 Result:', JSON.stringify(result, null, 2));
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => sql.end());
