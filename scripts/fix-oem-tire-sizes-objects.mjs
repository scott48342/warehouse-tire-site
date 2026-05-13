#!/usr/bin/env node
/**
 * Fix OEM Tire Sizes Object Arrays
 * 
 * Converts object arrays to string arrays in vehicle_fitments.oem_tire_sizes.
 * 
 * Safety features:
 * - Dry-run by default (no changes)
 * - Creates snapshot before writing
 * - Only converts if every object has valid size/tireSize
 * - Reports all changes
 * 
 * Usage:
 *   node scripts/fix-oem-tire-sizes-objects.mjs              # Dry run
 *   node scripts/fix-oem-tire-sizes-objects.mjs --apply      # Apply changes
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

async function fix() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(APPLY_MODE 
    ? "   🔧 FIX OEM TIRE SIZES (APPLY MODE - CHANGES WILL BE WRITTEN)"
    : "   🔍 FIX OEM TIRE SIZES (DRY RUN - NO CHANGES)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Get all records with object arrays
  const result = await pool.query(`
    SELECT 
      id,
      year,
      make,
      model,
      display_trim as trim,
      modification_id,
      oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL
      AND oem_tire_sizes::text != 'null'
      AND oem_tire_sizes::text != '[]'
    ORDER BY year DESC, make, model, display_trim
  `);
  const records = result.rows;

  const toFix = [];
  const skipped = [];

  for (const record of records) {
    const oemTireSizes = record.oem_tire_sizes;
    
    if (!Array.isArray(oemTireSizes) || oemTireSizes.length === 0) continue;
    
    const firstItem = oemTireSizes[0];
    
    // Skip if already string array
    if (typeof firstItem === "string") continue;
    
    // Check if it's an object array we can convert
    if (typeof firstItem === "object" && firstItem !== null) {
      // Try to extract sizes from all objects
      const converted = [];
      let allValid = true;
      
      for (const obj of oemTireSizes) {
        if (typeof obj !== "object" || obj === null) {
          allValid = false;
          break;
        }
        
        // Try standard size/tireSize keys
        const sizeValue = obj.size || obj.tireSize;
        if (typeof sizeValue === "string" && sizeValue.trim()) {
          converted.push(sizeValue.trim());
          continue;
        }
        
        // Try width/aspectRatio/diameter format (GMC Envoy style)
        if (obj.width && obj.aspectRatio && obj.diameter) {
          const reconstructed = `${obj.width}/${obj.aspectRatio}R${obj.diameter}`;
          converted.push(reconstructed);
          continue;
        }
        
        // Unknown format
        allValid = false;
        break;
      }
      
      if (allValid && converted.length > 0) {
        toFix.push({
          id: record.id,
          year: record.year,
          make: record.make,
          model: record.model,
          trim: record.trim,
          modificationId: record.modification_id,
          before: oemTireSizes,
          after: converted,
        });
      } else {
        skipped.push({
          id: record.id,
          year: record.year,
          make: record.make,
          model: record.model,
          trim: record.trim,
          modificationId: record.modification_id,
          reason: "Not all objects have valid size/tireSize",
          value: oemTireSizes,
        });
      }
    }
  }

  console.log(`Found ${toFix.length} records to fix`);
  console.log(`Skipped ${skipped.length} records (invalid format)\n`);

  if (toFix.length === 0) {
    console.log("✅ No records need fixing!");
    await pool.end();
    return;
  }

  // Show what will be changed
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    CHANGES");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const fix of toFix) {
    console.log(`${fix.year} ${fix.make} ${fix.model} ${fix.trim || "(no trim)"}`);
    console.log(`  ID: ${fix.id}`);
    console.log(`  Before: ${JSON.stringify(fix.before)}`);
    console.log(`  After:  ${JSON.stringify(fix.after)}`);
    console.log("");
  }

  if (skipped.length > 0) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                    SKIPPED");
    console.log("═══════════════════════════════════════════════════════════════\n");

    for (const skip of skipped) {
      console.log(`${skip.year} ${skip.make} ${skip.model} ${skip.trim || "(no trim)"}`);
      console.log(`  ID: ${skip.id}`);
      console.log(`  Reason: ${skip.reason}`);
      console.log(`  Value: ${JSON.stringify(skip.value)}`);
      console.log("");
    }
  }

  if (!APPLY_MODE) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  DRY RUN COMPLETE - No changes made");
    console.log("  Run with --apply to write changes");
    console.log("═══════════════════════════════════════════════════════════════\n");
    await pool.end();
    return;
  }

  // Create snapshot directory
  const snapshotDir = "scripts/oem-tire-sizes-snapshots";
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  // Create snapshot
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotPath = path.join(snapshotDir, `snapshot-${timestamp}.json`);
  
  const snapshot = {
    createdAt: new Date().toISOString(),
    recordCount: toFix.length,
    records: toFix.map(f => ({
      id: f.id,
      year: f.year,
      make: f.make,
      model: f.model,
      trim: f.trim,
      modificationId: f.modificationId,
      originalValue: f.before,
    })),
  };
  
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`📸 Snapshot saved to: ${snapshotPath}\n`);

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
        [JSON.stringify(fix.after), fix.id]
      );
      console.log(`  ✅ ${fix.year} ${fix.make} ${fix.model} ${fix.trim || ""}`);
      successCount++;
    } catch (err) {
      console.log(`  ❌ ${fix.year} ${fix.make} ${fix.model} ${fix.trim || ""}: ${err.message}`);
      errorCount++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                    COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors:  ${errorCount}`);
  console.log(`  📸 Snapshot: ${snapshotPath}`);
  console.log("");

  await pool.end();
}

fix().catch(err => {
  console.error("Fix failed:", err);
  process.exit(1);
});
