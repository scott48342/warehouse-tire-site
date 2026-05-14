/**
 * Classify 4,380 staggered vehicles missing rear wheel data
 * 
 * Safe source hierarchy (NO sibling/platform auto-fill):
 * 1. Existing exact WTD record with front/rear data (same Y/M/M/T)
 * 2. USAF explicit front/rear tire pairing
 * 3. WheelPros/Techfeed compatibility evidence
 * 4. OEM-verified reference/manual review
 * 5. Sibling/platform = SUPPORTING EVIDENCE ONLY
 * 
 * DRY-RUN ONLY - No DB writes
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

// Performance keywords that indicate likely staggered fitment
const STAGGERED_KEYWORDS = [
  'GT', 'Performance', 'Sport', 'Track', 'SS', 'SRT', 'AMG', 
  'M3', 'M4', 'M5', 'RS', 'Type R', 'Type S', 'Nismo', 'TRD',
  'Shelby', 'Hellcat', 'Demon', 'Widebody', '1LE', 'Z06', 'ZR1',
  'Grand Sport', 'Stingray', 'Z51', 'ZL1', 'GT350', 'GT500',
  'Dark Horse', 'Mach 1', 'Scat Pack', 'R/T', 'Quadrifoglio',
  'Competition', 'xDrive', 'Quattro'
];

function matchesStaggeredKeyword(model, trim) {
  const combined = `${model || ''} ${trim || ''}`;
  return STAGGERED_KEYWORDS.some(kw => 
    combined.toLowerCase().includes(kw.toLowerCase())
  );
}

function hasRearWheelData(wheelSizes) {
  if (!wheelSizes || !Array.isArray(wheelSizes)) return false;
  
  return wheelSizes.some(ws => {
    if (!ws || typeof ws !== 'object') return false;
    
    // Check for explicit rear data
    if (ws.rearWidth || ws.rearDiameter || ws.isStaggered) return true;
    
    // Check for front/rear sub-objects
    if (ws.front && ws.rear) {
      if (ws.front.width !== ws.rear.width) return true;
      if (ws.front.diameter !== ws.rear.diameter) return true;
    }
    
    // Check for position-tagged entries
    if (ws.position === 'rear') return true;
    
    return false;
  });
}

async function main() {
  console.log('\n🔍 Staggered Rear-Wheel Gap Classification');
  console.log('Mode: DRY-RUN (Analysis Only)');
  console.log('='.repeat(80));
  console.log('\nSafe source hierarchy:');
  console.log('  1. Existing exact WTD record with front/rear data (same Y/M/M/T)');
  console.log('  2. USAF explicit front/rear tire pairing');
  console.log('  3. WheelPros/Techfeed compatibility evidence');
  console.log('  4. OEM-verified reference/manual review');
  console.log('  5. Sibling/platform = SUPPORTING EVIDENCE ONLY');
  console.log('\n⚠️  NO auto-fill from siblings/platforms!\n');
  console.log('='.repeat(80));

  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Step 1: Find records matching staggered keywords but missing rear wheel data
    console.log('\n📊 Step 1: Finding performance vehicles missing rear wheel data...\n');
    
    const allRecords = await pool.query(`
      SELECT 
        id, year, make, model, display_trim, modification_id,
        oem_wheel_sizes, oem_tire_sizes, source, source_record_id,
        offset_min_mm, offset_max_mm
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2026
      ORDER BY year DESC, make, model, display_trim
    `);

    const missingRearData = [];
    const hasRearData = [];
    
    for (const row of allRecords.rows) {
      // Check if matches staggered keywords
      if (!matchesStaggeredKeyword(row.model, row.display_trim)) continue;
      
      const record = {
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.display_trim,
        modificationId: row.modification_id,
        source: row.source,
        sourceRecordId: row.source_record_id,
        wheelSizes: row.oem_wheel_sizes,
        tireSizes: row.oem_tire_sizes,
        offsetMin: row.offset_min_mm,
        offsetMax: row.offset_max_mm,
      };
      
      if (hasRearWheelData(row.oem_wheel_sizes)) {
        hasRearData.push(record);
      } else {
        missingRearData.push(record);
      }
    }

    console.log(`Found ${missingRearData.length} performance vehicles MISSING rear wheel data`);
    console.log(`Found ${hasRearData.length} performance vehicles WITH rear wheel data\n`);

    // Step 2: Group by Y/M/M/T
    console.log('📊 Step 2: Grouping by Year/Make/Model/Trim...\n');
    
    const byYMMT = new Map();
    for (const r of missingRearData) {
      const key = `${r.year}|${r.make}|${r.model}|${r.trim}`;
      if (!byYMMT.has(key)) {
        byYMMT.set(key, []);
      }
      byYMMT.get(key).push(r);
    }
    
    // Also index records WITH rear data for evidence checking
    const withDataByYMMT = new Map();
    for (const r of hasRearData) {
      const key = `${r.year}|${r.make}|${r.model}|${r.trim}`;
      if (!withDataByYMMT.has(key)) {
        withDataByYMMT.set(key, []);
      }
      withDataByYMMT.get(key).push(r);
    }
    
    // Index by Y/M/M (for sibling evidence - NOT auto-fill)
    const withDataByYMM = new Map();
    for (const r of hasRearData) {
      const key = `${r.year}|${r.make}|${r.model}`;
      if (!withDataByYMM.has(key)) {
        withDataByYMM.set(key, []);
      }
      withDataByYMM.get(key).push(r);
    }

    // Step 3: Classify each unique Y/M/M/T combination
    console.log('📊 Step 3: Classifying by evidence availability...\n');
    
    const classifications = {
      exactMatch: [],      // Same Y/M/M/T has complete data (different source)
      needsUSAF: [],       // Needs USAF front/rear tire pairing check
      needsWheelPros: [],  // Needs WheelPros/Techfeed cross-ref
      hasSiblingEvidence: [], // Sibling trim has data (NOT auto-fill, just evidence)
      manualReview: [],    // No evidence, needs OEM manual review
    };

    for (const [key, records] of byYMMT) {
      const [year, make, model, trim] = key.split('|');
      const ymmKey = `${year}|${make}|${model}`;
      
      // Check for exact match evidence (same Y/M/M/T from different source)
      const exactEvidence = withDataByYMMT.get(key) || [];
      
      // Check for sibling evidence (same Y/M/M, different trim)
      const siblingEvidence = (withDataByYMM.get(ymmKey) || [])
        .filter(r => r.trim !== trim);
      
      const entry = {
        year: parseInt(year),
        make,
        model,
        trim,
        recordCount: records.length,
        recordIds: records.map(r => r.id),
        sources: [...new Set(records.map(r => r.source))],
        hasExactMatchEvidence: exactEvidence.length > 0,
        exactEvidenceSources: exactEvidence.map(r => r.source),
        hasSiblingEvidence: siblingEvidence.length > 0,
        siblingTrims: [...new Set(siblingEvidence.map(r => r.trim))].slice(0, 5),
        sampleWheelSizes: records[0].wheelSizes,
      };

      // Classify
      if (entry.hasExactMatchEvidence) {
        classifications.exactMatch.push(entry);
      } else if (entry.hasSiblingEvidence) {
        // Sibling evidence = supporting only, not auto-fix
        entry.classification = 'SUPPORTING_EVIDENCE_ONLY';
        entry.note = 'Sibling trims have data - can use as reference for manual verification';
        classifications.hasSiblingEvidence.push(entry);
      } else {
        // No WTD evidence at all
        entry.classification = 'NEEDS_EXTERNAL_VERIFICATION';
        classifications.manualReview.push(entry);
      }
    }

    // Step 4: Print summary
    console.log('='.repeat(80));
    console.log('📋 CLASSIFICATION SUMMARY');
    console.log('='.repeat(80));
    
    const exactCount = classifications.exactMatch.reduce((sum, e) => sum + e.recordCount, 0);
    const siblingCount = classifications.hasSiblingEvidence.reduce((sum, e) => sum + e.recordCount, 0);
    const manualCount = classifications.manualReview.reduce((sum, e) => sum + e.recordCount, 0);
    
    console.log(`\nTotal performance vehicles missing rear wheel data: ${missingRearData.length}`);
    console.log(`Unique Y/M/M/T combinations: ${byYMMT.size}\n`);
    
    console.log('--- SAFE AUTO-FIX CANDIDATES ---');
    console.log(`✅ Exact Y/M/M/T match (different source): ${classifications.exactMatch.length} combos (${exactCount} records)`);
    console.log(`   → Can merge from other source with identical Y/M/M/T\n`);
    
    console.log('--- NEEDS EXTERNAL VERIFICATION ---');
    console.log(`⚠️  Has sibling evidence (NOT auto-fill): ${classifications.hasSiblingEvidence.length} combos (${siblingCount} records)`);
    console.log(`   → Sibling trims have data - use as REFERENCE for USAF/WheelPros/OEM check\n`);
    
    console.log(`⚠️  Manual review needed: ${classifications.manualReview.length} combos (${manualCount} records)`);
    console.log(`   → No WTD evidence - needs USAF, WheelPros, or OEM verification\n`);

    // Step 5: Show exact match details (safe auto-fix)
    if (classifications.exactMatch.length > 0) {
      console.log('='.repeat(80));
      console.log('✅ SAFE AUTO-FIX: Exact Y/M/M/T Matches');
      console.log('='.repeat(80));
      console.log('\nThese have the SAME Year/Make/Model/Trim from different sources:');
      console.log('One source has rear data, another is missing it.\n');
      
      for (const e of classifications.exactMatch.slice(0, 30)) {
        console.log(`  ${e.year} ${e.make} ${e.model} ${e.trim}`);
        console.log(`    Missing: ${e.recordCount} records (${e.sources.join(', ')})`);
        console.log(`    Evidence: ${e.exactEvidenceSources.join(', ')}`);
        console.log();
      }
      if (classifications.exactMatch.length > 30) {
        console.log(`  ... and ${classifications.exactMatch.length - 30} more exact matches\n`);
      }
    }

    // Step 6: Show top vehicles needing verification (grouped by make/model)
    console.log('='.repeat(80));
    console.log('📊 TOP VEHICLES NEEDING VERIFICATION');
    console.log('='.repeat(80));
    
    // Group by make/model for easier prioritization
    const byMakeModel = new Map();
    for (const e of [...classifications.hasSiblingEvidence, ...classifications.manualReview]) {
      const key = `${e.make}|${e.model}`;
      if (!byMakeModel.has(key)) {
        byMakeModel.set(key, { 
          make: e.make, 
          model: e.model, 
          years: new Set(), 
          trims: new Set(),
          totalRecords: 0,
          hasSiblingEvidence: false 
        });
      }
      const mm = byMakeModel.get(key);
      mm.years.add(e.year);
      mm.trims.add(e.trim);
      mm.totalRecords += e.recordCount;
      if (e.hasSiblingEvidence) mm.hasSiblingEvidence = true;
    }

    // Sort by record count
    const sortedMM = [...byMakeModel.values()]
      .sort((a, b) => b.totalRecords - a.totalRecords)
      .slice(0, 40);

    console.log('\nVehicle | Records | Years | Trims | Sibling Evidence');
    console.log('-'.repeat(100));
    
    for (const mm of sortedMM) {
      const yearRange = [...mm.years].sort().join(',');
      const trimList = [...mm.trims].slice(0, 3).join(', ');
      const sibling = mm.hasSiblingEvidence ? '✓ YES' : '✗ NO';
      console.log(`${mm.make} ${mm.model.padEnd(25)} | ${String(mm.totalRecords).padStart(7)} | ${yearRange.padEnd(20)} | ${trimList.padEnd(30)} | ${sibling}`);
    }

    // Step 7: Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMissingRear: missingRearData.length,
        totalWithRear: hasRearData.length,
        uniqueYMMT: byYMMT.size,
        safeExactMatch: {
          combos: classifications.exactMatch.length,
          records: exactCount,
        },
        siblingEvidenceOnly: {
          combos: classifications.hasSiblingEvidence.length,
          records: siblingCount,
        },
        manualReviewNeeded: {
          combos: classifications.manualReview.length,
          records: manualCount,
        },
      },
      rules: {
        note: 'Sibling/platform records are SUPPORTING EVIDENCE ONLY - never auto-apply',
        safeAutoFix: 'Only exact Y/M/M/T matches from different sources',
        needsVerification: 'All others need USAF, WheelPros, or OEM manual verification',
      },
      exactMatches: classifications.exactMatch,
      siblingEvidence: classifications.hasSiblingEvidence,
      manualReview: classifications.manualReview,
      byMakeModel: sortedMM.map(mm => ({
        make: mm.make,
        model: mm.model,
        totalRecords: mm.totalRecords,
        years: [...mm.years].sort(),
        trims: [...mm.trims],
        hasSiblingEvidence: mm.hasSiblingEvidence,
      })),
    };

    const reportPath = join(__dirname, 'staggered-rear-gap-classification.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Step 8: Final recommendations
    console.log('\n' + '='.repeat(80));
    console.log('📋 RECOMMENDED NEXT STEPS');
    console.log('='.repeat(80));
    console.log(`
1. SAFE TO FIX NOW (${exactCount} records):
   → ${classifications.exactMatch.length} exact Y/M/M/T matches can be merged
   
2. NEEDS USAF CHECK (${siblingCount} records):
   → Query USAF GetVehicleOptions for explicit front/rear tire pairings
   → ${classifications.hasSiblingEvidence.length} vehicles have sibling evidence as reference
   
3. NEEDS WHEELPROS/TECHFEED (${manualCount} records):
   → Cross-reference with WheelPros fitment data
   → Check Techfeed compatibility files
   
4. MANUAL/OEM REVIEW:
   → Any remaining after external verification
   → Check manufacturer service manuals
`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
