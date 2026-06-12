/**
 * Phase 4: Bulk Import Framework
 * 
 * Imports validated fitments to the database.
 * - Idempotent (can re-run safely)
 * - Version controlled (timestamps + source tags)
 * - Generates import report
 * 
 * @created 2026-06-12
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';
const OUTPUT_DIR = './scripts/coverage-audit/reports';

async function importFitments(records) {
  const url = `${BASE_URL}/api/admin/fitment/manual`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Import failed (${response.status}): ${text}`);
  }
  
  return await response.json();
}

async function runImport() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('WTD BULK IMPORT - Phase 4');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);
  
  // Load validated imports
  const importPath = path.join(OUTPUT_DIR, 'validated-imports.json');
  if (!fs.existsSync(importPath)) {
    console.error('Run phase3-validate.mjs first!');
    process.exit(1);
  }
  
  const importData = JSON.parse(fs.readFileSync(importPath, 'utf-8'));
  console.log(`\nRecords to import: ${importData.records.length}`);
  
  // Dry run option
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - no changes will be made\n');
    console.log('Records that would be imported:');
    for (const r of importData.records) {
      console.log(`  ${r.year} ${r.make} ${r.model}`);
      console.log(`    Bolt: ${r.boltPattern} | CB: ${r.centerBoreMm}mm | Thread: ${r.threadSize}`);
    }
    return;
  }
  
  // Confirm
  console.log('\nVehicles to import:');
  const grouped = {};
  for (const r of importData.records) {
    const key = `${r.make}:${r.model}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r.year);
  }
  for (const [key, years] of Object.entries(grouped)) {
    console.log(`  ${key}: ${years.sort().join(', ')}`);
  }
  
  console.log('\n🚀 Starting import...');
  
  try {
    const result = await importFitments(importData.records);
    
    // Save result
    const resultPath = path.join(OUTPUT_DIR, `import-result-${Date.now()}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('IMPORT COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total: ${result.total}`);
    console.log(`Inserted: ${result.inserted}`);
    console.log(`Updated: ${result.updated}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Failed: ${result.failed}`);
    
    if (result.errors?.length > 0) {
      console.log('\nErrors:');
      for (const e of result.errors) {
        console.log(`  ${e}`);
      }
    }
    
    if (result.coverage) {
      console.log(`\nNew Coverage: ${result.coverage.coveragePercent}%`);
    }
    
    console.log(`\nFull result saved to: ${resultPath}`);
    
    return result;
    
  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    process.exit(1);
  }
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
