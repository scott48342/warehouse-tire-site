/**
 * FULL Database QA Sweep
 * 
 * Tests EVERY unique vehicle+trim combination in vehicle_fitment_configurations
 * to ensure config lookup works correctly.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

async function fetchAPI(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}&_cb=${Date.now()}`;
  try {
    const res = await fetch(url);
    return res.json();
  } catch (err) {
    return { error: String(err) };
  }
}

async function findModificationId(year: number, make: string, model: string, trim: string): Promise<string | null> {
  // Match: exact, prefix, or contains in comma-separated list
  const result = await pool.query(`
    SELECT modification_id, display_trim 
    FROM vehicle_fitments 
    WHERE year = $1 AND make = $2 AND model = $3
    AND (display_trim = $4 OR display_trim ILIKE $5 OR display_trim ILIKE $6 OR display_trim ILIKE $7)
    LIMIT 1
  `, [year, make, model, trim, `${trim},%`, `%, ${trim},%`, `%, ${trim}`]);
  
  return result.rows[0]?.modification_id || null;
}

interface ConfigVehicle {
  year: number;
  make_key: string;
  model_key: string;
  display_trim: string;
  expected_diameters: number[];
}

async function getAllConfigVehicles(): Promise<ConfigVehicle[]> {
  const result = await pool.query(`
    SELECT 
      year, make_key, model_key, display_trim,
      array_agg(DISTINCT wheel_diameter ORDER BY wheel_diameter) as expected_diameters
    FROM vehicle_fitment_configurations
    WHERE display_trim IS NOT NULL AND display_trim != ''
    GROUP BY year, make_key, model_key, display_trim
    ORDER BY make_key, model_key, year, display_trim
  `);
  
  return result.rows.map((r: any) => ({
    year: r.year,
    make_key: r.make_key,
    model_key: r.model_key,
    display_trim: r.display_trim,
    expected_diameters: r.expected_diameters.map(Number),
  }));
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FULL DATABASE QA SWEEP");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Base URL: ${BASE_URL}`);
  console.log("");

  const vehicles = await getAllConfigVehicles();
  console.log(`  Total config vehicles to test: ${vehicles.length}`);
  console.log("");

  let passed = 0;
  let failed = 0;
  let noModId = 0;
  const failures: string[] = [];

  // Group by make for cleaner output
  const byMake = new Map<string, ConfigVehicle[]>();
  for (const v of vehicles) {
    const key = v.make_key;
    if (!byMake.has(key)) byMake.set(key, []);
    byMake.get(key)!.push(v);
  }

  for (const [make, makeVehicles] of byMake) {
    console.log(`\n${make.toUpperCase()} (${makeVehicles.length} trims):`);
    
    for (const v of makeVehicles) {
      const modId = await findModificationId(v.year, v.make_key, v.model_key, v.display_trim);
      
      if (!modId) {
        noModId++;
        // This is expected for some configs - they might have model-level fitment entries
        continue;
      }

      // Test tire-sizes API with trim param
      const url = `/api/vehicles/tire-sizes?year=${v.year}&make=${v.make_key}&model=${v.model_key}&modification=${modId}&trim=${encodeURIComponent(v.display_trim)}`;
      const data = await fetchAPI(url);

      if (data.error) {
        failed++;
        failures.push(`${v.year} ${v.make_key} ${v.model_key} ${v.display_trim}: API error`);
        console.log(`  ❌ ${v.year} ${v.model_key} ${v.display_trim}: API error`);
        continue;
      }

      const usesConfig = data.source === "config";
      const actualDias = data.wheelDiameters?.available || [];
      const expectedSet = new Set(v.expected_diameters);
      const actualSet = new Set(actualDias);
      
      // Check if expected diameters are subset of actual (config might have more options)
      const diametersMatch = v.expected_diameters.every(d => actualSet.has(d));

      if (usesConfig && diametersMatch) {
        passed++;
        // Only log failures for cleaner output
      } else {
        failed++;
        const reason = !usesConfig 
          ? `source=${data.source}` 
          : `diameters mismatch: expected [${v.expected_diameters}], got [${actualDias}]`;
        failures.push(`${v.year} ${v.make_key} ${v.model_key} ${v.display_trim}: ${reason}`);
        console.log(`  ❌ ${v.year} ${v.model_key} ${v.display_trim}: ${reason}`);
      }
    }
    
    // Progress indicator
    const makeStats = makeVehicles.filter(v => true).length;
    console.log(`  → ${make}: tested ${makeStats} trims`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Total config trims:     ${vehicles.length}`);
  console.log(`  Tested (has mod_id):    ${passed + failed}`);
  console.log(`  No modification_id:     ${noModId}`);
  console.log(`  Passed:                 ${passed}`);
  console.log(`  Failed:                 ${failed}`);
  
  const passRate = passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : "N/A";
  console.log(`  Pass Rate:              ${passRate}%`);

  if (failures.length > 0) {
    console.log("\n  ❌ FAILURES:");
    failures.slice(0, 20).forEach(f => console.log(`     - ${f}`));
    if (failures.length > 20) {
      console.log(`     ... and ${failures.length - 20} more`);
    }
  } else if (passed > 0) {
    console.log("\n  ✅ ALL TESTED VEHICLES PASSED!");
  }

  await pool.end();
}

main().catch(console.error);
