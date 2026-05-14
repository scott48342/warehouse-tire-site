/**
 * HIGH Severity Fix #3: Fix Missing Bolt Patterns
 * 
 * Apply high-confidence sibling bolt patterns.
 * Skip: Lamborghini Center Lock (complex), dual-axle vehicles
 * 
 * Usage:
 *   node fix-missing-bolt.mjs           # Dry-run
 *   node fix-missing-bolt.mjs --apply   # Apply changes
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

// Skip these patterns (complex cases)
const SKIP_PATTERNS = [
  /center lock/i,
  /lamborghini/i,
  /front |rear /i,  // Fake Front/Rear records
];

async function run() {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║   FIX MISSING BOLT PATTERNS                                   ║`);
  console.log(`║   Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`.padEnd(64) + `║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  // Find records with missing bolt pattern
  const missing = await sql`
    SELECT id, year, make, model, display_trim, bolt_pattern
    FROM vehicle_fitments
    WHERE (bolt_pattern IS NULL OR bolt_pattern = '')
      AND certification_status = 'certified'
    ORDER BY year DESC, make, model
  `;
  
  console.log(`Found ${missing.length} records with missing bolt pattern`);
  
  const fixes = [];
  const skipped = [];
  
  for (const rec of missing) {
    const fullName = `${rec.make} ${rec.display_trim}`;
    
    // Check skip patterns
    if (SKIP_PATTERNS.some(p => p.test(fullName))) {
      skipped.push({
        id: rec.id,
        year: rec.year,
        make: rec.make,
        model: rec.model,
        trim: rec.display_trim,
        reason: 'skip_pattern_match',
      });
      continue;
    }
    
    // Find sibling with bolt pattern
    const [sibling] = await sql`
      SELECT bolt_pattern, display_trim
      FROM vehicle_fitments
      WHERE year = ${rec.year}
        AND make = ${rec.make}
        AND model = ${rec.model}
        AND bolt_pattern IS NOT NULL
        AND bolt_pattern != ''
        AND certification_status = 'certified'
      LIMIT 1
    `;
    
    if (sibling?.bolt_pattern) {
      fixes.push({
        id: rec.id,
        year: rec.year,
        make: rec.make,
        model: rec.model,
        trim: rec.display_trim,
        newBoltPattern: sibling.bolt_pattern,
        siblingTrim: sibling.display_trim,
      });
    } else {
      // Try adjacent year
      const [adjacent] = await sql`
        SELECT bolt_pattern, year, display_trim
        FROM vehicle_fitments
        WHERE make = ${rec.make}
          AND model = ${rec.model}
          AND year BETWEEN ${rec.year - 1} AND ${rec.year + 1}
          AND bolt_pattern IS NOT NULL
          AND bolt_pattern != ''
          AND certification_status = 'certified'
        LIMIT 1
      `;
      
      if (adjacent?.bolt_pattern) {
        fixes.push({
          id: rec.id,
          year: rec.year,
          make: rec.make,
          model: rec.model,
          trim: rec.display_trim,
          newBoltPattern: adjacent.bolt_pattern,
          siblingYear: adjacent.year,
          siblingTrim: adjacent.display_trim,
        });
      } else {
        skipped.push({
          id: rec.id,
          year: rec.year,
          make: rec.make,
          model: rec.model,
          trim: rec.display_trim,
          reason: 'no_sibling_reference',
        });
      }
    }
  }
  
  console.log(`\nFixes to apply: ${fixes.length}`);
  console.log(`Skipped: ${skipped.length}`);
  
  // Show fixes
  console.log(`\nProposed fixes:`);
  for (const fix of fixes) {
    console.log(`  ${fix.year} ${fix.make} ${fix.model} "${fix.trim}"`);
    console.log(`    → ${fix.newBoltPattern} (from ${fix.siblingYear || 'same year'} "${fix.siblingTrim}")`);
  }
  
  console.log(`\nSkipped:`);
  for (const skip of skipped) {
    console.log(`  ${skip.year} ${skip.make} ${skip.model} "${skip.trim}" - ${skip.reason}`);
  }
  
  if (!APPLY) {
    console.log(`\n⚠️  DRY-RUN: No changes made.`);
    console.log(`    To apply, run with --apply`);
    await sql.end();
    return;
  }
  
  // Create snapshot
  const snapshotDir = resolve(__dirname, 'snapshots');
  mkdirSync(snapshotDir, { recursive: true });
  
  const ids = fixes.map(f => f.id);
  const snapshot = await sql`
    SELECT * FROM vehicle_fitments WHERE id = ANY(${ids})
  `;
  
  const snapshotPath = resolve(snapshotDir, `bolt-fix-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot saved to: ${snapshotPath}`);
  
  // Apply fixes
  let updated = 0;
  for (const fix of fixes) {
    const result = await sql`
      UPDATE vehicle_fitments
      SET bolt_pattern = ${fix.newBoltPattern}
      WHERE id = ${fix.id}
    `;
    updated++;
  }
  
  console.log(`✅ Updated ${updated} records`);
  
  // Write results
  const outputDir = resolve(__dirname, 'output');
  const resultsPath = resolve(outputDir, `bolt-fix-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    action: 'fix_bolt_pattern',
    recordsUpdated: updated,
    fixes,
    skipped,
    snapshotPath,
  }, null, 2));
  
  console.log(`Results written to: ${resultsPath}`);
  
  await sql.end();
}

run().catch(err => {
  console.error('Fix failed:', err);
  process.exit(1);
});
