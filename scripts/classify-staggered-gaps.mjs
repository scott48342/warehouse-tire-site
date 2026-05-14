// Classify staggered rear-wheel gaps by evidence availability
// DRY-RUN ONLY - No DB writes
// 
// Safe source hierarchy:
// 1. Existing exact WTD record with front/rear data (same year/make/model/trim)
// 2. USAF explicit front/rear tire pairing
// 3. WheelPros/Techfeed compatibility evidence
// 4. OEM-verified reference/manual review
// 5. Sibling/platform = supporting evidence only, NEVER auto-apply

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

async function main() {
  console.log(`\n🔍 Staggered Rear-Wheel Gap Classification`);
  console.log(`Mode: DRY-RUN (Analysis Only)\n`);
  console.log('='.repeat(80));

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ No database connection string found');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Step 1: Find records that appear to be staggered but missing rear wheel data
    // Indicators of staggered:
    // - oem_tire_sizes has front/rear object format
    // - oem_wheel_sizes has different front/rear
    // - known staggered trims (Mustang GT PP, Camaro SS 1LE, etc.)
    
    console.log('\n📊 Step 1: Finding records with staggered indicators but missing rear wheel specs...\n');
    
    // Query for records with staggered tire sizes (front/rear format)
    const staggeredQuery = await pool.query(`
      SELECT 
        id, year, make, model, display_trim, modification_id,
        oem_tire_sizes, oem_wheel_sizes,
        offset_min_mm, offset_max_mm,
        source, source_record_id
      FROM vehicle_fitments
      WHERE 
        -- Has front/rear tire format (JSONB object with front/rear keys)
        (jsonb_typeof(oem_tire_sizes) = 'object' 
         AND oem_tire_sizes ? 'front' 
         AND oem_tire_sizes ? 'rear')
        -- OR has different front/rear wheel sizes
        OR (jsonb_typeof(oem_wheel_sizes) = 'object'
            AND oem_wheel_sizes ? 'front'
            AND oem_wheel_sizes ? 'rear')
      ORDER BY year DESC, make, model, display_trim
    `);

    console.log(`Found ${staggeredQuery.rows.length} records with staggered indicators\n`);

    // Step 2: Classify each record by what rear wheel data exists
    const classifications = {
      hasCompleteRearData: [],      // Already has rear wheel width/offset
      missingRearWheelWidth: [],    // Has rear tires but no rear wheel width
      missingRearOffset: [],        // Has rear wheel size but no rear offset
      missingBothRearSpecs: [],     // Missing both rear wheel width and offset
    };

    // Also track by vehicle for grouping
    const byVehicle = new Map(); // key: "year|make|model" -> array of records

    for (const record of staggeredQuery.rows) {
      const wheelSizes = record.oem_wheel_sizes;
      const tireSizes = record.oem_tire_sizes;
      
      // Check what wheel data exists
      let hasRearWheelWidth = false;
      let hasRearOffset = false;
      let frontWheelWidth = null;
      let rearWheelWidth = null;
      
      if (wheelSizes && typeof wheelSizes === 'object') {
        // Check if rear wheel specs exist
        if (wheelSizes.rear) {
          // Parse rear wheel size (e.g., "19x10" or "19x10.5")
          const rearMatch = String(wheelSizes.rear).match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
          if (rearMatch) {
            rearWheelWidth = parseFloat(rearMatch[2]);
            hasRearWheelWidth = true;
          }
        }
        if (wheelSizes.front) {
          const frontMatch = String(wheelSizes.front).match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
          if (frontMatch) {
            frontWheelWidth = parseFloat(frontMatch[2]);
          }
        }
      }
      
      // Check offset - if there's only one offset range, it's likely front-only
      // Proper staggered should have different front/rear offsets or explicit rear offset
      // For now, assume single offset = front only
      const hasExplicitRearOffset = false; // TODO: Check if schema has rear_offset columns
      
      const vehicleKey = `${record.year}|${record.make}|${record.model}`;
      if (!byVehicle.has(vehicleKey)) {
        byVehicle.set(vehicleKey, []);
      }
      
      const recordInfo = {
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.display_trim,
        modificationId: record.modification_id,
        source: record.source,
        tireSizes: tireSizes,
        wheelSizes: wheelSizes,
        frontWheelWidth,
        rearWheelWidth,
        offsetMin: record.offset_min_mm,
        offsetMax: record.offset_max_mm,
      };
      
      byVehicle.get(vehicleKey).push(recordInfo);
      
      if (hasRearWheelWidth) {
        classifications.hasCompleteRearData.push(recordInfo);
      } else {
        classifications.missingBothRearSpecs.push(recordInfo);
      }
    }

    // Step 3: Print summary
    console.log('\n📋 CLASSIFICATION SUMMARY:\n');
    console.log(`  ✅ Complete rear wheel data: ${classifications.hasCompleteRearData.length}`);
    console.log(`  ❌ Missing rear wheel specs: ${classifications.missingBothRearSpecs.length}`);
    console.log(`\n  Total staggered records: ${staggeredQuery.rows.length}`);

    // Step 4: Group missing records by vehicle
    console.log('\n\n📊 Step 2: Grouping gaps by Year/Make/Model...\n');
    console.log('='.repeat(80));

    const vehicleSummary = [];
    
    for (const [vehicleKey, records] of byVehicle) {
      const [year, make, model] = vehicleKey.split('|');
      const missingRecords = records.filter(r => !r.rearWheelWidth);
      const completeRecords = records.filter(r => r.rearWheelWidth);
      
      if (missingRecords.length > 0) {
        vehicleSummary.push({
          year: parseInt(year),
          make,
          model,
          totalRecords: records.length,
          missingCount: missingRecords.length,
          completeCount: completeRecords.length,
          trims: missingRecords.map(r => r.trim),
          sources: [...new Set(missingRecords.map(r => r.source))],
          // Check if ANY record for this exact Y/M/M has complete data
          hasExactMatchEvidence: completeRecords.length > 0,
          completeTrims: completeRecords.map(r => r.trim),
        });
      }
    }

    // Sort by year desc, then make, then model
    vehicleSummary.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if (a.make !== b.make) return a.make.localeCompare(b.make);
      return a.model.localeCompare(b.model);
    });

    // Print top vehicles with gaps
    console.log('\nTop 50 Vehicles with Staggered Gaps:\n');
    console.log('Year | Make | Model | Missing | Complete | Has Exact Evidence | Trims');
    console.log('-'.repeat(100));

    for (const v of vehicleSummary.slice(0, 50)) {
      const evidence = v.hasExactMatchEvidence ? '✅ YES' : '❌ NO';
      console.log(`${v.year} | ${v.make.padEnd(12)} | ${v.model.padEnd(20)} | ${String(v.missingCount).padStart(7)} | ${String(v.completeCount).padStart(8)} | ${evidence.padEnd(18)} | ${v.trims.slice(0, 3).join(', ')}${v.trims.length > 3 ? '...' : ''}`);
    }

    // Step 5: Identify safe auto-fix candidates (EXACT MATCH ONLY)
    console.log('\n\n📊 Step 3: Identifying SAFE Auto-Fix Candidates...\n');
    console.log('='.repeat(80));
    console.log('\nCriteria for safe auto-fix:');
    console.log('  1. Exact same Year/Make/Model/Trim has complete rear wheel data in WTD DB');
    console.log('  2. OR: USAF has explicit front/rear tire pairing for exact Y/M/M/T');
    console.log('  3. OR: Multiple independent sources (WheelPros + Techfeed) agree on specs');
    console.log('\n⚠️  Sibling/platform records are SUPPORTING EVIDENCE ONLY, not auto-fill source\n');

    // Find exact-match evidence
    const safeAutoFix = [];
    const needsManualReview = [];
    const needsUSAFCheck = [];
    const needsWheelProsCheck = [];

    for (const v of vehicleSummary) {
      if (v.hasExactMatchEvidence) {
        // We have complete data for SAME vehicle, different trim
        // But per rules, this is NOT auto-apply - same model different trim is still sibling
        // Only EXACT year/make/model/TRIM match counts
        needsManualReview.push({
          ...v,
          reason: 'Has sibling trim with data (supporting evidence only)',
          evidenceTrims: v.completeTrims,
        });
      } else {
        // No WTD evidence at all
        needsManualReview.push({
          ...v,
          reason: 'No WTD evidence - needs USAF/WheelPros/OEM verification',
        });
      }
    }

    // Check for duplicates - same Y/M/M/T with different records (one complete, one missing)
    console.log('\n🔍 Checking for EXACT Y/M/M/T duplicates with different completeness...\n');
    
    const exactDupeQuery = await pool.query(`
      WITH staggered_records AS (
        SELECT 
          id, year, make, model, display_trim, modification_id,
          oem_tire_sizes, oem_wheel_sizes,
          source
        FROM vehicle_fitments
        WHERE 
          (jsonb_typeof(oem_tire_sizes) = 'object' 
           AND oem_tire_sizes ? 'front' 
           AND oem_tire_sizes ? 'rear')
          OR (jsonb_typeof(oem_wheel_sizes) = 'object'
              AND oem_wheel_sizes ? 'front'
              AND oem_wheel_sizes ? 'rear')
      )
      SELECT 
        year, make, model, display_trim,
        COUNT(*) as record_count,
        array_agg(id) as ids,
        array_agg(source) as sources,
        array_agg(oem_wheel_sizes::text) as wheel_sizes_list
      FROM staggered_records
      GROUP BY year, make, model, display_trim
      HAVING COUNT(*) > 1
      ORDER BY year DESC, make, model, display_trim
    `);

    console.log(`Found ${exactDupeQuery.rows.length} Y/M/M/T combinations with multiple staggered records\n`);

    // Analyze duplicates for potential safe merges
    let safeExactMerges = 0;
    const exactMergeCandidates = [];

    for (const dupe of exactDupeQuery.rows) {
      // Check if any record has complete wheel sizes while others don't
      const wheelSizesList = dupe.wheel_sizes_list.map(ws => {
        try {
          return JSON.parse(ws);
        } catch {
          return ws;
        }
      });

      const hasCompleteRear = wheelSizesList.some(ws => {
        if (ws && typeof ws === 'object' && ws.rear) {
          const rearMatch = String(ws.rear).match(/\d+x\d+/i);
          return !!rearMatch;
        }
        return false;
      });

      const hasMissingRear = wheelSizesList.some(ws => {
        if (ws && typeof ws === 'object') {
          if (!ws.rear) return true;
          const rearMatch = String(ws.rear).match(/\d+x\d+/i);
          return !rearMatch;
        }
        return true;
      });

      if (hasCompleteRear && hasMissingRear) {
        safeExactMerges++;
        exactMergeCandidates.push({
          year: dupe.year,
          make: dupe.make,
          model: dupe.model,
          trim: dupe.display_trim,
          recordCount: dupe.record_count,
          ids: dupe.ids,
          sources: dupe.sources,
          wheelSizes: wheelSizesList,
        });
      }
    }

    console.log(`\n✅ SAFE EXACT MERGE CANDIDATES: ${safeExactMerges}`);
    console.log('   (Same Y/M/M/T where one record has complete rear data, another missing)\n');

    if (exactMergeCandidates.length > 0) {
      console.log('Exact Merge Candidates (first 20):');
      console.log('-'.repeat(100));
      for (const c of exactMergeCandidates.slice(0, 20)) {
        console.log(`  ${c.year} ${c.make} ${c.model} ${c.trim}`);
        console.log(`    Records: ${c.recordCount}, Sources: ${c.sources.join(', ')}`);
        console.log(`    Wheel sizes: ${JSON.stringify(c.wheelSizes)}`);
        console.log();
      }
    }

    // Step 6: Final summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 FINAL CLASSIFICATION SUMMARY');
    console.log('='.repeat(80));
    
    const totalMissing = classifications.missingBothRearSpecs.length;
    
    console.log(`\nTotal staggered records analyzed: ${staggeredQuery.rows.length}`);
    console.log(`Records with complete rear wheel data: ${classifications.hasCompleteRearData.length}`);
    console.log(`Records MISSING rear wheel specs: ${totalMissing}`);
    console.log(`\nUnique vehicles with gaps: ${vehicleSummary.length}`);
    console.log(`\n--- SAFE AUTO-FIX CANDIDATES ---`);
    console.log(`✅ Exact Y/M/M/T merge candidates: ${safeExactMerges}`);
    console.log(`   (Different sources for same vehicle, one has data)`);
    console.log(`\n--- NEEDS VERIFICATION ---`);
    console.log(`⚠️  Needs USAF check: ${vehicleSummary.length - safeExactMerges}`);
    console.log(`⚠️  Needs WheelPros/Techfeed cross-reference: ${vehicleSummary.length}`);
    console.log(`⚠️  Needs manual/OEM review: ${needsManualReview.filter(v => !v.hasExactMatchEvidence).length}`);

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalStaggeredRecords: staggeredQuery.rows.length,
        completeRearData: classifications.hasCompleteRearData.length,
        missingRearSpecs: totalMissing,
        uniqueVehiclesWithGaps: vehicleSummary.length,
        safeExactMergeCandidates: safeExactMerges,
      },
      safeExactMerges: exactMergeCandidates,
      vehiclesWithGaps: vehicleSummary,
      recordsNeedingManualReview: needsManualReview,
    };

    const reportPath = join(__dirname, 'staggered-gap-classification.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
