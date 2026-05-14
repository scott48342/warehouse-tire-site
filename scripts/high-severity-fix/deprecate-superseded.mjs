/**
 * HIGH Severity Fix #1: Deprecate Fake Front/Rear Trims
 * 
 * These records have canonical merged records already - just mark as deprecated.
 * 
 * Usage:
 *   node deprecate-superseded.mjs           # Dry-run
 *   node deprecate-superseded.mjs --apply   # Apply changes
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const APPLY = process.argv.includes('--apply');
const sql = postgres(process.env.POSTGRES_URL);

async function run() {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║   DEPRECATE SUPERSEDED FAKE FRONT/REAR TRIMS                   ║`);
  console.log(`║   Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`.padEnd(64) + `║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  // Load analysis results
  const analysisPath = resolve(__dirname, 'output/fake-trim-analysis.json');
  const analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
  
  const toDeprecate = analysis.categories.already_superseded;
  console.log(`Records to deprecate: ${toDeprecate.length}`);
  
  if (toDeprecate.length === 0) {
    console.log('Nothing to deprecate!');
    await sql.end();
    return;
  }
  
  // Create snapshot before any changes
  const snapshotDir = resolve(__dirname, 'snapshots');
  mkdirSync(snapshotDir, { recursive: true });
  
  const ids = toDeprecate.map(r => r.id);
  const snapshot = await sql`
    SELECT * FROM vehicle_fitments WHERE id = ANY(${ids})
  `;
  
  const snapshotPath = resolve(snapshotDir, `deprecate-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot saved to: ${snapshotPath}`);
  
  // Group by canonical for logging
  const byCanonical = {};
  for (const rec of toDeprecate) {
    const key = `${rec.year} ${rec.make} ${rec.model} "${rec.canonicalTrim}"`;
    if (!byCanonical[key]) {
      byCanonical[key] = { canonical: rec.canonicalId, fakes: [] };
    }
    byCanonical[key].fakes.push(rec.fakeTrim);
  }
  
  // Show sample
  console.log(`\nSample of deprecations:`);
  const sampleKeys = Object.keys(byCanonical).slice(0, 10);
  for (const key of sampleKeys) {
    const { fakes } = byCanonical[key];
    console.log(`  ${key}`);
    for (const fake of fakes) {
      console.log(`    ← "${fake}"`);
    }
  }
  if (Object.keys(byCanonical).length > 10) {
    console.log(`  ... and ${Object.keys(byCanonical).length - 10} more vehicles`);
  }
  
  if (!APPLY) {
    console.log(`\n⚠️  DRY-RUN: No changes made.`);
    console.log(`    To apply, run with --apply`);
    await sql.end();
    return;
  }
  
  // Apply deprecation
  console.log(`\nApplying deprecation to ${ids.length} records...`);
  
  const result = await sql`
    UPDATE vehicle_fitments
    SET certification_status = 'deprecated-superseded-by-canonical'
    WHERE id = ANY(${ids})
    RETURNING id
  `;
  
  console.log(`✅ Deprecated ${result.length} records`);
  
  // Write results
  const outputDir = resolve(__dirname, 'output');
  const resultsPath = resolve(outputDir, `deprecate-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    action: 'deprecate',
    recordsDeprecated: result.length,
    ids: ids,
    snapshotPath,
  }, null, 2));
  
  console.log(`Results written to: ${resultsPath}`);
  
  await sql.end();
}

run().catch(err => {
  console.error('Deprecation failed:', err);
  process.exit(1);
});
