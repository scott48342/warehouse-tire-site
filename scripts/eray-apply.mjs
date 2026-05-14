#!/usr/bin/env node
/**
 * Corvette E-Ray Staggered Apply
 * 
 * Applies canonical {front, rear} format to E-Ray records only.
 * Same tire sizes as Z06: 275/30ZR20 front, 345/25ZR21 rear
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const ERAY_CANONICAL = {
  front: '275/30ZR20',
  rear: '345/25ZR21'
};

async function applyEray(dryRun = true) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   CORVETTE E-RAY CANONICAL APPLY                             ║');
  console.log(`║   Mode: ${dryRun ? 'DRY RUN' : 'LIVE APPLY'}                                         ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const sql = postgres(process.env.POSTGRES_URL);

  // Get all E-Ray records
  const erayRecords = await sql`
    SELECT id, year, display_trim, oem_tire_sizes, oem_wheel_sizes, source
    FROM vehicle_fitments 
    WHERE make='Chevrolet' AND model='Corvette' AND display_trim ILIKE '%E-Ray%'
    ORDER BY year DESC, display_trim
  `;

  console.log(`Found ${erayRecords.length} E-Ray records\n`);

  // Filter to only records that need conversion
  const needsConversion = erayRecords.filter(r => {
    const ts = r.oem_tire_sizes;
    // Skip if already canonical
    if (ts?.front && ts?.rear) return false;
    // Must be array with exactly our expected sizes
    if (!Array.isArray(ts)) return false;
    if (ts.length !== 2) return false;
    const sorted = [...ts].sort();
    const expected = ['275/30ZR20', '345/25ZR21'].sort();
    return sorted[0] === expected[0] && sorted[1] === expected[1];
  });

  console.log(`Records needing conversion: ${needsConversion.length}`);
  
  if (needsConversion.length === 0) {
    console.log('\n✅ All E-Ray records already in canonical format');
    await sql.end();
    return { applied: 0, skipped: erayRecords.length };
  }

  console.log('\nRecords to convert:');
  for (const r of needsConversion) {
    console.log(`  ${r.id} - ${r.year} ${r.display_trim}`);
    console.log(`    FROM: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`    TO:   ${JSON.stringify(ERAY_CANONICAL)}`);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes made');
    await sql.end();
    return { dryRun: true, wouldApply: needsConversion.length };
  }

  // Create snapshot
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const snapshotDir = resolve(__dirname, 'staggered-inference/output/snapshots');
  mkdirSync(snapshotDir, { recursive: true });
  const snapshotPath = resolve(snapshotDir, `eray-snapshot-${timestamp}.json`);

  const snapshotData = {
    timestamp,
    recordCount: needsConversion.length,
    records: needsConversion,
    canonicalFormat: ERAY_CANONICAL,
  };
  writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2));
  console.log(`\n📸 Snapshot saved: ${snapshotPath}`);

  // Apply updates
  console.log('\n✏️  Applying updates...');
  let applied = 0;
  let errors = 0;

  for (const r of needsConversion) {
    try {
      await sql`
        UPDATE vehicle_fitments
        SET 
          oem_tire_sizes = ${sql.json(ERAY_CANONICAL)},
          updated_at = NOW()
        WHERE id = ${r.id}::uuid
      `;
      applied++;
      console.log(`  ✅ ${r.year} ${r.display_trim}`);
    } catch (err) {
      errors++;
      console.log(`  ❌ ${r.year} ${r.display_trim}: ${err.message}`);
    }
  }

  console.log(`\n✅ Applied: ${applied}`);
  if (errors > 0) console.log(`❌ Errors: ${errors}`);

  // Save results
  const resultsPath = resolve(__dirname, 'staggered-inference/output', `eray-results-${timestamp}.json`);
  writeFileSync(resultsPath, JSON.stringify({
    timestamp,
    applied,
    errors,
    snapshotPath,
    canonicalFormat: ERAY_CANONICAL,
  }, null, 2));
  console.log(`📁 Results saved: ${resultsPath}`);

  await sql.end();
  return { applied, errors };
}

// Parse args
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

applyEray(dryRun).then(result => {
  if (result.dryRun) {
    console.log(`\n🔍 DRY RUN COMPLETE: ${result.wouldApply} records would be updated`);
    console.log('Run with --apply to make changes');
  } else {
    console.log(`\n✅ E-RAY APPLY COMPLETE: ${result.applied} records updated`);
  }
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
