#!/usr/bin/env node
/**
 * Mustang GT/Shelby + BMW M3 CS Staggered Apply
 * 
 * Based on OEM data from TireGuide screenshots (2026-05-14)
 * 
 * BMW M3 CS (2021-2026):
 *   Front: 275/35ZR19 (19x9.5)
 *   Rear: 285/30ZR20 (20x10.5)
 * 
 * Mustang mappings by trim:
 *   GT/GT Premium (staggered): Front 255/40R19, Rear 275/40R19
 *   Shelby GT350: Front 295/35R19, Rear 305/35R19
 *   Shelby GT350R: Front 305/30R19, Rear 315/30R19
 *   Shelby GT500: Front 305/30ZR20, Rear 315/30ZR20
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

// ═══════════════════════════════════════════════════════════════════════════
// MAPPINGS FROM OEM DATA (TireGuide screenshots 2026-05-14)
// ═══════════════════════════════════════════════════════════════════════════

const BMW_M3_CS_MAPPING = {
  front: '275/35ZR19',
  rear: '285/30ZR20'
};

// Mustang mappings - match by trim pattern
const MUSTANG_MAPPINGS = [
  {
    pattern: /^Shelby GT500/i,
    canonical: { front: '305/30ZR20', rear: '315/30ZR20' },
    note: 'GT500 (all packages)'
  },
  {
    pattern: /^Shelby GT350R/i,
    canonical: { front: '305/30ZR19', rear: '315/30ZR19' },
    note: 'GT350R'
  },
  {
    pattern: /^Shelby GT350(?!R)/i,
    canonical: { front: '295/35ZR19', rear: '305/35ZR19' },
    note: 'GT350 (non-R)'
  },
  {
    pattern: /^GT\s*(Premium)?\s*(Performance|Front|Rear)?/i,
    canonical: { front: '255/40R19', rear: '275/40R19' },
    note: 'GT / GT Premium with Performance Package'
  },
];

function getMustangMapping(trim) {
  for (const m of MUSTANG_MAPPINGS) {
    if (m.pattern.test(trim)) {
      return m;
    }
  }
  return null;
}

// Check if current tire sizes match expected for the mapping
function sizesMatchMapping(currentSizes, mapping) {
  if (!Array.isArray(currentSizes)) return false;
  
  const normalizedCurrent = currentSizes.map(s => s.replace(/^P/, '').toUpperCase());
  const expectedFront = mapping.canonical.front.replace(/^P/, '').toUpperCase();
  const expectedRear = mapping.canonical.rear.replace(/^P/, '').toUpperCase();
  
  // Check if both front and rear are present in current sizes
  return normalizedCurrent.some(s => s === expectedFront || s.replace('ZR', 'R') === expectedFront.replace('ZR', 'R')) &&
         normalizedCurrent.some(s => s === expectedRear || s.replace('ZR', 'R') === expectedRear.replace('ZR', 'R'));
}

async function apply(dryRun = true) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   MUSTANG + BMW M3 CS STAGGERED APPLY                        ║');
  console.log(`║   Mode: ${dryRun ? 'DRY RUN' : 'LIVE APPLY'}                                         ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const sql = postgres(process.env.POSTGRES_URL);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  const results = {
    timestamp,
    bmwM3CS: { applied: 0, skipped: 0, errors: 0, records: [] },
    mustang: { applied: 0, skipped: 0, errors: 0, records: [] },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BMW M3 CS
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('=== BMW M3 CS ===\n');
  
  const m3csRecords = await sql`
    SELECT id, year, display_trim, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make='BMW' AND model='M3' AND display_trim ILIKE '%CS%'
    ORDER BY year DESC
  `;

  for (const r of m3csRecords) {
    const ts = r.oem_tire_sizes;
    
    // Skip if already canonical
    if (ts?.front && ts?.rear) {
      console.log(`⏭️  ${r.year} M3 ${r.display_trim}: Already canonical`);
      results.bmwM3CS.skipped++;
      continue;
    }
    
    // Verify sizes match expected
    if (!Array.isArray(ts)) {
      console.log(`⚠️  ${r.year} M3 ${r.display_trim}: Unexpected format`);
      results.bmwM3CS.skipped++;
      continue;
    }

    // Check that 275/35 and 285/30 are present
    const has275 = ts.some(s => s.includes('275/35') || s.includes('275/30'));
    const has285 = ts.some(s => s.includes('285/30'));
    
    if (!has275 || !has285) {
      console.log(`⚠️  ${r.year} M3 ${r.display_trim}: Sizes don't match CS pattern`);
      console.log(`   Current: ${ts.join(', ')}`);
      results.bmwM3CS.skipped++;
      continue;
    }

    console.log(`✅ ${r.year} M3 ${r.display_trim}:`);
    console.log(`   FROM: ${JSON.stringify(ts)}`);
    console.log(`   TO:   ${JSON.stringify(BMW_M3_CS_MAPPING)}`);
    
    results.bmwM3CS.records.push({
      id: r.id,
      year: r.year,
      trim: r.display_trim,
      from: ts,
      to: BMW_M3_CS_MAPPING
    });

    if (!dryRun) {
      try {
        await sql`
          UPDATE vehicle_fitments
          SET oem_tire_sizes = ${sql.json(BMW_M3_CS_MAPPING)}, updated_at = NOW()
          WHERE id = ${r.id}::uuid
        `;
        results.bmwM3CS.applied++;
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        results.bmwM3CS.errors++;
      }
    } else {
      results.bmwM3CS.applied++;
    }
  }

  console.log(`\nBMW M3 CS: ${results.bmwM3CS.applied} to apply, ${results.bmwM3CS.skipped} skipped\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSTANG GT/SHELBY
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('=== MUSTANG GT/SHELBY ===\n');
  
  const mustangRecords = await sql`
    SELECT id, year, display_trim, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make='Ford' AND model='Mustang' 
      AND (display_trim ILIKE '%GT%' OR display_trim ILIKE '%Shelby%')
      AND display_trim NOT LIKE '%Front%' 
      AND display_trim NOT LIKE '%Rear%'
    ORDER BY year DESC, display_trim
  `;

  for (const r of mustangRecords) {
    const ts = r.oem_tire_sizes;
    
    // Skip if already canonical
    if (ts?.front && ts?.rear) {
      console.log(`⏭️  ${r.year} Mustang ${r.display_trim}: Already canonical`);
      results.mustang.skipped++;
      continue;
    }
    
    // Get mapping for this trim
    const mapping = getMustangMapping(r.display_trim);
    if (!mapping) {
      console.log(`⚠️  ${r.year} Mustang ${r.display_trim}: No mapping found`);
      results.mustang.skipped++;
      continue;
    }

    // Verify current sizes contain expected sizes
    if (!Array.isArray(ts)) {
      console.log(`⚠️  ${r.year} Mustang ${r.display_trim}: Unexpected format`);
      results.mustang.skipped++;
      continue;
    }

    // Check that both expected sizes are in the array
    const normalizedCurrent = ts.map(s => s.replace(/^P/, '').replace('ZR', 'R').toUpperCase());
    const expectedFront = mapping.canonical.front.replace(/^P/, '').replace('ZR', 'R').toUpperCase();
    const expectedRear = mapping.canonical.rear.replace(/^P/, '').replace('ZR', 'R').toUpperCase();
    
    const hasFront = normalizedCurrent.some(s => s === expectedFront);
    const hasRear = normalizedCurrent.some(s => s === expectedRear);

    if (!hasFront || !hasRear) {
      console.log(`⚠️  ${r.year} Mustang ${r.display_trim}: Sizes don't match pattern (${mapping.note})`);
      console.log(`   Current: ${ts.join(', ')}`);
      console.log(`   Expected: ${mapping.canonical.front}, ${mapping.canonical.rear}`);
      results.mustang.skipped++;
      continue;
    }

    console.log(`✅ ${r.year} Mustang ${r.display_trim} (${mapping.note}):`);
    console.log(`   FROM: ${JSON.stringify(ts)}`);
    console.log(`   TO:   ${JSON.stringify(mapping.canonical)}`);
    
    results.mustang.records.push({
      id: r.id,
      year: r.year,
      trim: r.display_trim,
      from: ts,
      to: mapping.canonical,
      note: mapping.note
    });

    if (!dryRun) {
      try {
        await sql`
          UPDATE vehicle_fitments
          SET oem_tire_sizes = ${sql.json(mapping.canonical)}, updated_at = NOW()
          WHERE id = ${r.id}::uuid
        `;
        results.mustang.applied++;
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        results.mustang.errors++;
      }
    } else {
      results.mustang.applied++;
    }
  }

  console.log(`\nMustang: ${results.mustang.applied} to apply, ${results.mustang.skipped} skipped\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const totalApply = results.bmwM3CS.applied + results.mustang.applied;
  const totalSkip = results.bmwM3CS.skipped + results.mustang.skipped;
  
  console.log(`BMW M3 CS:  ${results.bmwM3CS.applied} records`);
  console.log(`Mustang:    ${results.mustang.applied} records`);
  console.log(`────────────────────────────────`);
  console.log(`TOTAL:      ${totalApply} records`);
  console.log(`Skipped:    ${totalSkip}`);

  if (dryRun) {
    // Save dry-run results
    const outputDir = resolve(__dirname, 'staggered-inference/output');
    mkdirSync(outputDir, { recursive: true });
    const resultsPath = resolve(outputDir, `mustang-bmw-dryrun-${timestamp}.json`);
    writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Dry-run results: ${resultsPath}`);
    console.log('\n🔍 DRY RUN - No changes made. Run with --apply to apply.\n');
  } else {
    // Save snapshot and results
    const snapshotDir = resolve(__dirname, 'staggered-inference/output/snapshots');
    mkdirSync(snapshotDir, { recursive: true });
    const snapshotPath = resolve(snapshotDir, `mustang-bmw-snapshot-${timestamp}.json`);
    writeFileSync(snapshotPath, JSON.stringify(results, null, 2));
    console.log(`\n📸 Snapshot: ${snapshotPath}`);
    console.log(`\n✅ APPLIED ${totalApply} records\n`);
  }

  await sql.end();
  return results;
}

// Parse args
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

apply(dryRun).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
