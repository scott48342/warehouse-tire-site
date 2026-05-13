#!/usr/bin/env node
/**
 * Audit OEM Tire Sizes Format
 * 
 * Finds all vehicle_fitments records where oem_tire_sizes uses object arrays
 * instead of string arrays.
 * 
 * Expected format: ["275/65R18", "275/60R20"]
 * Problem format:  [{ "size": "275/65R18" }] or [{ "tireSize": "275/65R18" }]
 * 
 * Usage: node scripts/audit-oem-tire-sizes-format.mjs
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function audit() {
  console.log("🔍 Auditing oem_tire_sizes format in vehicle_fitments...\n");

  // Get all records with non-empty oem_tire_sizes
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

  const objectArrayRecords = [];
  const stringArrayRecords = [];
  const malformedRecords = [];

  for (const record of records) {
    const oemTireSizes = record.oem_tire_sizes;
    
    if (!Array.isArray(oemTireSizes)) {
      malformedRecords.push({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.trim,
        modificationId: record.modification_id,
        oemTireSizes,
        issue: "not_an_array",
      });
      continue;
    }

    if (oemTireSizes.length === 0) continue;

    const firstItem = oemTireSizes[0];
    
    if (typeof firstItem === "string") {
      stringArrayRecords.push({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.trim,
        modificationId: record.modification_id,
        oemTireSizes,
      });
    } else if (typeof firstItem === "object" && firstItem !== null) {
      // Check what keys the object has
      const keys = Object.keys(firstItem);
      const hasSize = keys.includes("size");
      const hasTireSize = keys.includes("tireSize");
      
      objectArrayRecords.push({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.trim,
        modificationId: record.modification_id,
        oemTireSizes,
        objectKeys: keys,
        hasSize,
        hasTireSize,
        canConvert: hasSize || hasTireSize,
      });
    } else {
      malformedRecords.push({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.trim,
        modificationId: record.modification_id,
        oemTireSizes,
        issue: "unknown_item_type",
        firstItemType: typeof firstItem,
      });
    }
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    AUDIT SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log(`Total records with oem_tire_sizes: ${records.length}`);
  console.log(`  ✅ String arrays (correct):      ${stringArrayRecords.length}`);
  console.log(`  ⚠️  Object arrays (needs fix):   ${objectArrayRecords.length}`);
  console.log(`  ❌ Malformed:                    ${malformedRecords.length}`);
  console.log("");

  if (objectArrayRecords.length > 0) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("           OBJECT ARRAY RECORDS (NEEDS FIX)");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Group by convertibility
    const convertible = objectArrayRecords.filter(r => r.canConvert);
    const notConvertible = objectArrayRecords.filter(r => !r.canConvert);

    if (convertible.length > 0) {
      console.log(`✅ CAN CONVERT (${convertible.length} records):\n`);
      for (const rec of convertible) {
        console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || "(no trim)"}`);
        console.log(`    ID: ${rec.id}`);
        console.log(`    Current: ${JSON.stringify(rec.oemTireSizes)}`);
        const converted = rec.oemTireSizes.map(obj => obj.size || obj.tireSize).filter(Boolean);
        console.log(`    Would become: ${JSON.stringify(converted)}`);
        console.log("");
      }
    }

    if (notConvertible.length > 0) {
      console.log(`❌ CANNOT CONVERT (${notConvertible.length} records):\n`);
      for (const rec of notConvertible) {
        console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || "(no trim)"}`);
        console.log(`    ID: ${rec.id}`);
        console.log(`    Current: ${JSON.stringify(rec.oemTireSizes)}`);
        console.log(`    Object keys: ${rec.objectKeys.join(", ")}`);
        console.log("");
      }
    }
  }

  if (malformedRecords.length > 0) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("              MALFORMED RECORDS");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    for (const rec of malformedRecords) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || "(no trim)"}`);
      console.log(`    ID: ${rec.id}`);
      console.log(`    Issue: ${rec.issue}`);
      console.log(`    Value: ${JSON.stringify(rec.oemTireSizes)}`);
      console.log("");
    }
  }

  // Output JSON for cleanup script
  if (objectArrayRecords.length > 0) {
    const outputPath = "scripts/oem-tire-sizes-object-records.json";
    const fs = await import("fs");
    fs.writeFileSync(outputPath, JSON.stringify({
      auditedAt: new Date().toISOString(),
      totalObjectArrayRecords: objectArrayRecords.length,
      convertible: objectArrayRecords.filter(r => r.canConvert).length,
      notConvertible: objectArrayRecords.filter(r => !r.canConvert).length,
      records: objectArrayRecords,
    }, null, 2));
    console.log(`\n📄 Full results written to: ${outputPath}`);
  }

  await pool.end();
}

audit().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
