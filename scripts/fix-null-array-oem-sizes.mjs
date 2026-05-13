#!/usr/bin/env node
/**
 * Fix Null-Array OEM Tire Sizes
 * 
 * Recovers tire sizes for [null] records using:
 * 1. Sibling trims with matching wheel diameter
 * 2. USAF GetVehicleOptions (if available)
 * 
 * Requirements:
 * - No guessing - only use exact diameter matches
 * - Snapshot before write
 * - Dry-run by default
 * - Mark manual review if no confident source
 * 
 * Usage:
 *   node scripts/fix-null-array-oem-sizes.mjs           # Dry run
 *   node scripts/fix-null-array-oem-sizes.mjs --apply   # Apply changes
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
import fs from "fs";
import path from "path";

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const APPLY_MODE = process.argv.includes("--apply");

/**
 * Extract wheel diameter from oem_wheel_sizes JSON
 */
function getWheelDiameter(oemWheelSizes) {
  if (!Array.isArray(oemWheelSizes) || oemWheelSizes.length === 0) return null;
  const first = oemWheelSizes[0];
  if (first && typeof first.diameter === "number") return first.diameter;
  return null;
}

/**
 * Extract rim diameter from tire size string (e.g., "P275/40ZR17" -> 17)
 */
function extractRimDiameter(tireSize) {
  const match = tireSize.match(/R(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Filter tire sizes to those matching a specific wheel diameter
 */
function filterByDiameter(tireSizes, diameter) {
  if (!Array.isArray(tireSizes)) return [];
  return tireSizes.filter(size => {
    const rimDia = extractRimDiameter(size);
    return rimDia === diameter;
  });
}

async function fix() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(APPLY_MODE 
    ? "   🔧 FIX NULL-ARRAY OEM SIZES (APPLY MODE)"
    : "   🔍 FIX NULL-ARRAY OEM SIZES (DRY RUN)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Get all null-array records
  const nullRecords = await pool.query(`
    SELECT 
      id, year, make, model, display_trim, 
      oem_tire_sizes, oem_wheel_sizes,
      bolt_pattern, center_bore_mm, modification_id
    FROM vehicle_fitments
    WHERE oem_tire_sizes::text = '[null]'
    ORDER BY year DESC, make, model, display_trim
  `);

  console.log(`Found ${nullRecords.rows.length} null-array records\n`);

  const toFix = [];
  const manualReview = [];
  const noAction = [];

  for (const record of nullRecords.rows) {
    const wheelDiameter = getWheelDiameter(record.oem_wheel_sizes);
    const label = `${record.year} ${record.make} ${record.model} - ${record.display_trim}`;

    // Look for sibling trims with valid tire sizes
    const siblings = await pool.query(`
      SELECT DISTINCT display_trim, oem_tire_sizes
      FROM vehicle_fitments
      WHERE year = $1 
        AND LOWER(make) = LOWER($2) 
        AND LOWER(model) = LOWER($3)
        AND id != $4
        AND oem_tire_sizes IS NOT NULL 
        AND oem_tire_sizes::text != '[null]'
        AND oem_tire_sizes::text != '[]'
        AND jsonb_typeof(oem_tire_sizes) = 'array'
    `, [record.year, record.make, record.model, record.id]);

    let recoveredSizes = null;
    let source = null;
    let confidence = "none";

    if (siblings.rows.length > 0 && wheelDiameter) {
      // Collect all sibling sizes and filter by matching diameter
      const allSiblingTireSizes = [];
      for (const sib of siblings.rows) {
        if (Array.isArray(sib.oem_tire_sizes)) {
          allSiblingTireSizes.push(...sib.oem_tire_sizes);
        }
      }
      
      // Get unique sizes that match our wheel diameter
      const matchingSizes = [...new Set(filterByDiameter(allSiblingTireSizes, wheelDiameter))];
      
      if (matchingSizes.length > 0) {
        recoveredSizes = matchingSizes;
        source = `sibling_diameter_match (${wheelDiameter}")`;
        confidence = "high";
      } else {
        // Siblings exist but no diameter match
        manualReview.push({
          record,
          label,
          wheelDiameter,
          siblingTrims: siblings.rows.map(s => s.display_trim),
          siblingTireSizes: allSiblingTireSizes,
          reason: `Wheel diameter ${wheelDiameter}" doesn't match any sibling tire sizes`,
        });
        continue;
      }
    } else if (siblings.rows.length === 0) {
      // No siblings at all
      manualReview.push({
        record,
        label,
        wheelDiameter,
        reason: "No sibling trims with valid tire sizes",
      });
      continue;
    } else if (!wheelDiameter) {
      // No wheel diameter to filter by
      manualReview.push({
        record,
        label,
        wheelDiameter: null,
        siblingTrims: siblings.rows.map(s => s.display_trim),
        reason: "No wheel diameter to filter sibling sizes",
      });
      continue;
    }

    if (recoveredSizes && confidence === "high") {
      toFix.push({
        record,
        label,
        wheelDiameter,
        before: record.oem_tire_sizes,
        after: recoveredSizes,
        source,
        confidence,
      });
    }
  }

  // Report
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    RECOVERY SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log(`✅ High-confidence recoverable: ${toFix.length}`);
  console.log(`⚠️  Needs manual review: ${manualReview.length}`);
  console.log(`Total: ${nullRecords.rows.length}\n`);

  if (toFix.length > 0) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("              HIGH-CONFIDENCE FIXES");
    console.log("═══════════════════════════════════════════════════════════════\n");

    for (const fix of toFix) {
      console.log(`✅ ${fix.label}`);
      console.log(`   Wheel: ${fix.wheelDiameter}"`);
      console.log(`   Before: ${JSON.stringify(fix.before)}`);
      console.log(`   After: ${JSON.stringify(fix.after)}`);
      console.log(`   Source: ${fix.source}`);
      console.log("");
    }
  }

  if (manualReview.length > 0) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("              NEEDS MANUAL REVIEW");
    console.log("═══════════════════════════════════════════════════════════════\n");

    for (const item of manualReview) {
      console.log(`⚠️  ${item.label}`);
      console.log(`   ID: ${item.record.id}`);
      console.log(`   Wheel: ${item.wheelDiameter ? item.wheelDiameter + '"' : 'unknown'}`);
      console.log(`   Reason: ${item.reason}`);
      if (item.siblingTrims) {
        console.log(`   Sibling trims: ${item.siblingTrims.join(", ")}`);
      }
      if (item.siblingTireSizes) {
        console.log(`   Sibling sizes: ${[...new Set(item.siblingTireSizes)].join(", ")}`);
      }
      console.log("");
    }
  }

  if (!APPLY_MODE) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  DRY RUN COMPLETE - No changes made");
    console.log("  Run with --apply to write high-confidence fixes only");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    // Write manual review report
    const reportPath = "scripts/null-array-manual-review.json";
    fs.writeFileSync(reportPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      count: manualReview.length,
      records: manualReview.map(m => ({
        id: m.record.id,
        year: m.record.year,
        make: m.record.make,
        model: m.record.model,
        trim: m.record.display_trim,
        wheelDiameter: m.wheelDiameter,
        reason: m.reason,
        siblingTrims: m.siblingTrims,
        siblingTireSizes: m.siblingTireSizes ? [...new Set(m.siblingTireSizes)] : null,
      })),
    }, null, 2));
    console.log(`📄 Manual review report: ${reportPath}`);
    
    await pool.end();
    return;
  }

  if (toFix.length === 0) {
    console.log("✅ No high-confidence fixes to apply");
    await pool.end();
    return;
  }

  // Create snapshot
  const snapshotDir = "scripts/null-array-snapshots";
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotPath = path.join(snapshotDir, `snapshot-${timestamp}.json`);
  
  const snapshot = {
    createdAt: new Date().toISOString(),
    recordCount: toFix.length,
    records: toFix.map(f => ({
      id: f.record.id,
      year: f.record.year,
      make: f.record.make,
      model: f.record.model,
      trim: f.record.display_trim,
      originalValue: f.before,
      wheelDiameter: f.wheelDiameter,
    })),
  };
  
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`\n📸 Snapshot saved to: ${snapshotPath}\n`);

  // Apply changes
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    APPLYING CHANGES");
  console.log("═══════════════════════════════════════════════════════════════\n");

  let successCount = 0;
  let errorCount = 0;

  for (const fix of toFix) {
    try {
      await pool.query(
        `UPDATE vehicle_fitments 
         SET oem_tire_sizes = $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(fix.after), fix.record.id]
      );
      console.log(`  ✅ ${fix.label}`);
      successCount++;
    } catch (err) {
      console.log(`  ❌ ${fix.label}: ${err.message}`);
      errorCount++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                    COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors:  ${errorCount}`);
  console.log(`  ⚠️  Manual review: ${manualReview.length}`);
  console.log(`  📸 Snapshot: ${snapshotPath}`);
  console.log("");

  await pool.end();
}

fix().catch(err => {
  console.error("Fix failed:", err);
  process.exit(1);
});
