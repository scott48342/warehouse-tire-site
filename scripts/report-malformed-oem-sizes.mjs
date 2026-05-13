#!/usr/bin/env node
/**
 * Report Malformed OEM Tire Sizes
 * 
 * Categorizes and reports the 761 malformed oem_tire_sizes records
 * without modifying any data.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function report() {
  console.log("🔍 Analyzing malformed oem_tire_sizes records...\n");

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

  const categories = {
    stringifiedJson: [],      // "[\"275/65R18\"]"
    staggeredObject: [],      // { front: [...], rear: [...] }
    staggeredStringValues: [],// { front: "245/40R17", rear: "255/35R17" }
    nullArray: [],            // [null]
    emptyFrontRear: [],       // { front: [], rear: [] } with no sizes
    other: [],
  };

  for (const row of result.rows) {
    const val = row.oem_tire_sizes;
    
    // Already correct array format - skip
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
      continue;
    }
    
    // Stringified JSON: "[\"275/65R18\"]"
    if (typeof val === "string") {
      categories.stringifiedJson.push({
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim,
        value: val,
        canFix: val.startsWith("[") && val.endsWith("]"),
      });
      continue;
    }
    
    // Object with front/rear (staggered)
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const hasArrayValues = Array.isArray(val.front) || Array.isArray(val.rear);
      const hasStringValues = typeof val.front === "string" || typeof val.rear === "string";
      
      if (hasArrayValues) {
        const frontSizes = Array.isArray(val.front) ? val.front.filter(Boolean) : [];
        const rearSizes = Array.isArray(val.rear) ? val.rear.filter(Boolean) : [];
        
        if (frontSizes.length > 0 || rearSizes.length > 0) {
          categories.staggeredObject.push({
            id: row.id,
            year: row.year,
            make: row.make,
            model: row.model,
            trim: row.trim,
            front: frontSizes,
            rear: rearSizes,
            canFix: true,
            wouldBecome: [...frontSizes, ...rearSizes],
          });
        } else {
          categories.emptyFrontRear.push({
            id: row.id,
            year: row.year,
            make: row.make,
            model: row.model,
            trim: row.trim,
            value: val,
          });
        }
      } else if (hasStringValues) {
        categories.staggeredStringValues.push({
          id: row.id,
          year: row.year,
          make: row.make,
          model: row.model,
          trim: row.trim,
          front: val.front,
          rear: val.rear,
          canFix: true,
          wouldBecome: [val.front, val.rear].filter(Boolean),
        });
      } else {
        categories.other.push({
          id: row.id,
          year: row.year,
          make: row.make,
          model: row.model,
          trim: row.trim,
          value: val,
        });
      }
      continue;
    }
    
    // Array with null elements
    if (Array.isArray(val) && val.some(v => v === null || v === undefined)) {
      categories.nullArray.push({
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim,
        value: val,
      });
      continue;
    }
    
    // Other
    categories.other.push({
      id: row.id,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim,
      value: val,
    });
  }

  // Report
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("            MALFORMED OEM_TIRE_SIZES REPORT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const total = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Total malformed records: ${total}\n`);

  // Category 1: Stringified JSON
  console.log(`\n### 1. Stringified JSON (${categories.stringifiedJson.length} records)`);
  console.log("Format: \"[\\\"275/65R18\\\"]\" (JSON string instead of array)");
  console.log("Fix: JSON.parse() to array");
  if (categories.stringifiedJson.length > 0) {
    console.log("\nExamples:");
    for (const rec of categories.stringifiedJson.slice(0, 5)) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || ""}`);
      console.log(`    Value: ${rec.value}`);
    }
  }

  // Category 2: Staggered objects with arrays
  console.log(`\n### 2. Staggered Objects (Array Values) (${categories.staggeredObject.length} records)`);
  console.log("Format: { front: [...], rear: [...] }");
  console.log("Fix: Flatten to single array [front..., rear...]");
  if (categories.staggeredObject.length > 0) {
    console.log("\nExamples:");
    for (const rec of categories.staggeredObject.slice(0, 5)) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || ""}`);
      console.log(`    Front: ${JSON.stringify(rec.front)}`);
      console.log(`    Rear: ${JSON.stringify(rec.rear)}`);
      console.log(`    Would become: ${JSON.stringify(rec.wouldBecome)}`);
    }
  }

  // Category 3: Staggered with string values
  console.log(`\n### 3. Staggered Objects (String Values) (${categories.staggeredStringValues.length} records)`);
  console.log("Format: { front: \"245/40R17\", rear: \"255/35R17\" }");
  console.log("Fix: Convert to array [front, rear]");
  if (categories.staggeredStringValues.length > 0) {
    console.log("\nExamples:");
    for (const rec of categories.staggeredStringValues.slice(0, 5)) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || ""}`);
      console.log(`    Front: ${rec.front}, Rear: ${rec.rear}`);
      console.log(`    Would become: ${JSON.stringify(rec.wouldBecome)}`);
    }
  }

  // Category 4: Null arrays
  console.log(`\n### 4. Null Array Elements (${categories.nullArray.length} records)`);
  console.log("Format: [null] or [null, null]");
  console.log("Fix: Replace with [] or remove record");
  if (categories.nullArray.length > 0) {
    console.log("\nExamples:");
    for (const rec of categories.nullArray.slice(0, 5)) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || ""}`);
      console.log(`    Value: ${JSON.stringify(rec.value)}`);
    }
  }

  // Category 5: Empty front/rear
  console.log(`\n### 5. Empty Front/Rear (${categories.emptyFrontRear.length} records)`);
  console.log("Format: { front: [], rear: [] } with no actual sizes");
  console.log("Fix: Set to [] or investigate source");
  if (categories.emptyFrontRear.length > 0) {
    console.log("\nExamples:");
    for (const rec of categories.emptyFrontRear.slice(0, 5)) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || ""}`);
      console.log(`    Value: ${JSON.stringify(rec.value)}`);
    }
  }

  // Category 6: Other
  console.log(`\n### 6. Other/Unknown (${categories.other.length} records)`);
  if (categories.other.length > 0) {
    console.log("\nExamples:");
    for (const rec of categories.other.slice(0, 5)) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} ${rec.trim || ""}`);
      console.log(`    Value: ${JSON.stringify(rec.value)}`);
    }
  }

  // Summary table
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                      SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("| Category                      | Count | Fixable |");
  console.log("|-------------------------------|-------|---------|");
  console.log(`| Stringified JSON              | ${categories.stringifiedJson.length.toString().padStart(5)} | Yes     |`);
  console.log(`| Staggered (array values)      | ${categories.staggeredObject.length.toString().padStart(5)} | Yes     |`);
  console.log(`| Staggered (string values)     | ${categories.staggeredStringValues.length.toString().padStart(5)} | Yes     |`);
  console.log(`| Null array elements           | ${categories.nullArray.length.toString().padStart(5)} | Delete  |`);
  console.log(`| Empty front/rear              | ${categories.emptyFrontRear.length.toString().padStart(5)} | Delete  |`);
  console.log(`| Other/Unknown                 | ${categories.other.length.toString().padStart(5)} | Manual  |`);
  console.log(`| **TOTAL**                     | ${total.toString().padStart(5)} |         |`);

  // Write detailed JSON report
  const reportPath = "scripts/malformed-oem-sizes-report.json";
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: {
      total,
      stringifiedJson: categories.stringifiedJson.length,
      staggeredObject: categories.staggeredObject.length,
      staggeredStringValues: categories.staggeredStringValues.length,
      nullArray: categories.nullArray.length,
      emptyFrontRear: categories.emptyFrontRear.length,
      other: categories.other.length,
    },
    categories,
  }, null, 2));
  
  console.log(`\n📄 Detailed report: ${reportPath}`);

  await pool.end();
}

report().catch(err => {
  console.error("Report failed:", err);
  process.exit(1);
});
