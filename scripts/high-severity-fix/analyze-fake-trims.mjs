/**
 * HIGH Severity Fix #1: Analyze 696 Fake Front/Rear Trims
 * 
 * Categorizes:
 * - safe_merge_pairs: Front/Rear pair with no canonical exists
 * - already_superseded: Canonical merged record already exists → deprecate
 * - no_matching_pair: Only Front or only Rear exists
 * - unsafe_dual_axle: Known dual-axle vehicles (R8, Huracan) - skip
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// Known dual-axle vehicles that should NOT be auto-merged
const DUAL_AXLE_PATTERNS = [
  /audi.*r8/i,
  /lamborghini/i,
  /porsche.*918/i,
];

function isDualAxle(make, model) {
  const fullName = `${make} ${model}`;
  return DUAL_AXLE_PATTERNS.some(p => p.test(fullName));
}

async function analyze() {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║   ANALYZE FAKE FRONT/REAR TRIMS                               ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  // Find all fake Front/Rear trim records
  // Exclude legitimate DRW (Dual Rear Wheel) trims
  const fakeRecords = await sql`
    SELECT id, year, make, model, display_trim, modification_id, 
           oem_tire_sizes, oem_wheel_sizes, certification_status, source
    FROM vehicle_fitments
    WHERE (display_trim LIKE '%Front %' OR display_trim LIKE '%Rear %')
      AND display_trim NOT LIKE '%Dual Rear Wheel%'
      AND certification_status != 'deprecated-staggered-split'
    ORDER BY year, make, model, display_trim
  `;
  
  console.log(`Found ${fakeRecords.length} fake Front/Rear trim records\n`);
  
  const results = {
    timestamp: new Date().toISOString(),
    totalFakeRecords: fakeRecords.length,
    categories: {
      already_superseded: [],    // Canonical exists → deprecate these
      safe_merge_pairs: [],      // Front+Rear pair, no canonical → merge
      no_matching_pair: [],      // Only Front or only Rear
      unsafe_dual_axle: [],      // Skip these
    },
    byYearMakeModel: {},
  };
  
  // Group by year/make/model
  const grouped = {};
  for (const rec of fakeRecords) {
    const key = `${rec.year}|${rec.make}|${rec.model}`;
    if (!grouped[key]) {
      grouped[key] = { year: rec.year, make: rec.make, model: rec.model, records: [] };
    }
    grouped[key].records.push(rec);
  }
  
  console.log(`Grouped into ${Object.keys(grouped).length} unique year/make/model combinations\n`);
  
  for (const [key, group] of Object.entries(grouped)) {
    const { year, make, model, records } = group;
    
    // Check if dual-axle
    if (isDualAxle(make, model)) {
      for (const rec of records) {
        results.categories.unsafe_dual_axle.push({
          id: rec.id,
          year, make, model,
          trim: rec.display_trim,
          reason: 'dual_axle_vehicle',
        });
      }
      continue;
    }
    
    // Extract base trim names (remove "Front " and " Rear " patterns)
    const trimMap = {};
    for (const rec of records) {
      // Pattern: "SS Front SS" → base "SS"
      // Pattern: "ZL1 1LE Rear ZL1 1LE" → base "ZL1 1LE"
      let baseTrim = rec.display_trim
        .replace(/\s+Front\s+.*/i, '')
        .replace(/\s+Rear\s+.*/i, '')
        .replace(/^Front\s+/i, '')
        .replace(/^Rear\s+/i, '')
        .trim();
      
      // Also try extracting from the second half for "SS Front SS" pattern
      const match = rec.display_trim.match(/^(.+?)\s+(Front|Rear)\s+(.+)$/i);
      if (match && match[1].toLowerCase() === match[3].toLowerCase()) {
        baseTrim = match[1].trim();
      }
      
      if (!trimMap[baseTrim]) {
        trimMap[baseTrim] = { front: null, rear: null, baseTrim };
      }
      
      if (/front/i.test(rec.display_trim)) {
        trimMap[baseTrim].front = rec;
      } else if (/rear/i.test(rec.display_trim)) {
        trimMap[baseTrim].rear = rec;
      }
    }
    
    // For each base trim, check if canonical already exists
    for (const [baseTrim, pair] of Object.entries(trimMap)) {
      // Check for existing canonical record
      const [canonical] = await sql`
        SELECT id, display_trim, oem_tire_sizes, certification_status
        FROM vehicle_fitments
        WHERE year = ${year}
          AND make = ${make}
          AND model = ${model}
          AND display_trim = ${baseTrim}
          AND certification_status = 'certified'
        LIMIT 1
      `;
      
      if (canonical) {
        // Canonical exists! These Front/Rear records should be deprecated
        if (pair.front) {
          results.categories.already_superseded.push({
            id: pair.front.id,
            year, make, model,
            fakeTrim: pair.front.display_trim,
            canonicalId: canonical.id,
            canonicalTrim: canonical.display_trim,
            action: 'deprecate',
          });
        }
        if (pair.rear) {
          results.categories.already_superseded.push({
            id: pair.rear.id,
            year, make, model,
            fakeTrim: pair.rear.display_trim,
            canonicalId: canonical.id,
            canonicalTrim: canonical.display_trim,
            action: 'deprecate',
          });
        }
      } else if (pair.front && pair.rear) {
        // Both exist, no canonical → safe to merge
        results.categories.safe_merge_pairs.push({
          frontId: pair.front.id,
          rearId: pair.rear.id,
          year, make, model,
          baseTrim,
          frontTrim: pair.front.display_trim,
          rearTrim: pair.rear.display_trim,
          action: 'merge',
        });
      } else {
        // Only one exists
        const orphan = pair.front || pair.rear;
        results.categories.no_matching_pair.push({
          id: orphan.id,
          year, make, model,
          trim: orphan.display_trim,
          type: pair.front ? 'front_only' : 'rear_only',
          baseTrim,
          action: 'manual_review',
        });
      }
    }
  }
  
  // Summary
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`ANALYSIS COMPLETE`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Total fake records:      ${results.totalFakeRecords}`);
  console.log(`Already superseded:      ${results.categories.already_superseded.length} (→ deprecate)`);
  console.log(`Safe merge pairs:        ${results.categories.safe_merge_pairs.length} (→ merge)`);
  console.log(`No matching pair:        ${results.categories.no_matching_pair.length} (→ manual review)`);
  console.log(`Unsafe dual-axle:        ${results.categories.unsafe_dual_axle.length} (→ skip)`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  
  // Verify counts
  const accounted = 
    results.categories.already_superseded.length +
    (results.categories.safe_merge_pairs.length * 2) +
    results.categories.no_matching_pair.length +
    results.categories.unsafe_dual_axle.length;
  
  console.log(`Records accounted for: ${accounted} / ${results.totalFakeRecords}`);
  
  // Write results
  const outputDir = resolve(__dirname, 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, 'fake-trim-analysis.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to: ${outputPath}`);
  
  await sql.end();
  return results;
}

analyze().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
