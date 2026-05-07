/**
 * Lifted Package QA Sweep
 * 
 * Tests the lifted build flow for multiple vehicles across lift heights.
 * Saves results to database for admin/qa dashboard.
 * 
 * Usage:
 *   node scripts/qa-sweep/lifted-package-qa.mjs [options]
 * 
 * Options:
 *   --dry-run    Don't write to database
 * 
 * Environment:
 *   BASE_URL      Target environment URL
 *   POSTGRES_URL  Database connection string
 */

import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');

// Test vehicles
const VEHICLES = [
  { year: "2024", make: "Ram", model: "1500", trim: "Big Horn" },
  { year: "2024", make: "Ford", model: "F-150", trim: "XLT" },
  { year: "2024", make: "Chevrolet", model: "Silverado 1500", trim: "LT" },
  { year: "2024", make: "GMC", model: "Sierra 1500", trim: "Elevation" },
  { year: "2024", make: "Toyota", model: "Tacoma", trim: "SR5" },
  { year: "2024", make: "Toyota", model: "Tundra", trim: "SR5" },
  { year: "2024", make: "Jeep", model: "Wrangler", trim: "Rubicon" },
  { year: "2020", make: "Chevrolet", model: "Silverado 2500 HD", trim: "LT" },
];

// Lift heights to test (maps to presets: 2"=daily, 4"=offroad, 6"=extreme)
const LIFT_HEIGHTS = [2, 4, 6];

// Expected minimum tire diameters per lift height for half-ton trucks
const EXPECTED_MIN_TIRE_DIA = {
  2: 32,   // leveled should be ~32-33"
  4: 33,   // 4" lift should be ~33-35"
  6: 35,   // 6" lift should be ~35-37"
};

// Stock tire diameter approximations for common trucks
const STOCK_TIRE_DIAMETERS = {
  "ram|1500": 32,
  "ford|f-150": 32,
  "chevrolet|silverado 1500": 32,
  "gmc|sierra 1500": 32,
  "toyota|tacoma": 31,
  "toyota|tundra": 32,
  "jeep|wrangler": 32, // Rubicon comes with 33s stock
  "chevrolet|silverado 2500 hd": 33,
};

async function fetchJson(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      return { error: `HTTP ${res.status}`, status: res.status };
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      return { error: 'Timeout (30s)' };
    }
    return { error: err.message };
  }
}

function extractTireDiameter(tireSize) {
  if (!tireSize) return null;
  
  // Handle formats like "35x12.50R20" (flotation)
  const flotationMatch = tireSize.match(/^(\d+)x[\d.]+R\d+$/i);
  if (flotationMatch) {
    return parseInt(flotationMatch[1], 10);
  }
  
  // Handle formats like "285/70R17" (P-metric)
  const pMetricMatch = tireSize.match(/^(\d+)\/(\d+)R(\d+)$/i);
  if (pMetricMatch) {
    const width = parseInt(pMetricMatch[1], 10);
    const aspect = parseInt(pMetricMatch[2], 10);
    const rim = parseInt(pMetricMatch[3], 10);
    // Calculate diameter: (width * aspect/100 * 2 / 25.4) + rim
    const sidewall = (width * aspect / 100) / 25.4; // in inches
    const diameter = sidewall * 2 + rim;
    return Math.round(diameter * 10) / 10;
  }
  
  return null;
}

function isStockTireSize(tireSize, vehicle) {
  const key = `${vehicle.make.toLowerCase()}|${vehicle.model.toLowerCase()}`;
  const stockDia = STOCK_TIRE_DIAMETERS[key];
  if (!stockDia) return false;
  
  const tireDia = extractTireDiameter(tireSize);
  if (!tireDia) return false;
  
  // Consider it "stock" if within 1" of stock diameter
  return Math.abs(tireDia - stockDia) <= 1;
}

async function testVehicleLift(vehicle, liftInches) {
  const result = {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`,
    liftHeight: `${liftInches}"`,
    recommendedTireSize: null,
    outerDiameter: null,
    offsetRange: null,
    wheelResultCount: 0,
    tireResultCount: 0,
    stockSize: false,
    status: "PASS",
    failureReason: null,
    wheelDiameter: null,
    wheelWidth: null,
    warnings: [],
    debug: {},
  };

  // Map lift inches to preset ID
  const presetId = liftInches <= 2 ? "daily" : liftInches <= 4 ? "offroad" : "extreme";
  
  // 1. Get recommendation from lifted page logic
  // The lifted page uses getLiftRecommendation from liftedRecommendations.ts
  // We'll simulate by checking what the lifted page would pass to APIs
  
  // First, get trims for the vehicle
  const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
  const trimsData = await fetchJson(trimsUrl);
  
  let modification = null;
  if (trimsData.results && trimsData.results.length > 0) {
    // Try to find matching trim
    const trimMatch = trimsData.results.find(t => 
      t.label.toLowerCase().includes(vehicle.trim.toLowerCase()) ||
      vehicle.trim.toLowerCase().includes(t.label.toLowerCase())
    );
    modification = trimMatch?.modificationId || trimsData.results[0].modificationId;
  }
  
  result.debug.modification = modification;
  
  // 2. Simulate lifted page offset/tire recommendations
  // The lifted page hardcodes recommendations based on liftedRecommendations.ts
  // For testing, we'll use reasonable expected values and check what the APIs return
  
  // Expected offset ranges by lift level
  const expectedOffsets = {
    daily: { min: -12, max: 0 },
    offroad: { min: -18, max: 0 },
    extreme: { min: -50, max: -24 },
  };
  
  const offsetRange = expectedOffsets[presetId];
  result.offsetRange = `${offsetRange.min} to ${offsetRange.max}`;
  
  // Popular wheel diameter for lifted trucks
  const wheelDiameter = 20;
  result.wheelDiameter = wheelDiameter;
  
  // 3. Search wheels with lifted params
  const wheelsParams = new URLSearchParams({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    diameter: String(wheelDiameter),
    offsetMin: String(offsetRange.min),
    offsetMax: String(offsetRange.max),
    pageSize: "50",
  });
  if (modification) {
    wheelsParams.set("modification", modification);
  }
  
  const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?${wheelsParams}`;
  const wheelsData = await fetchJson(wheelsUrl);
  
  if (wheelsData.error) {
    result.status = "FAIL";
    result.failureReason = `Wheels API error: ${wheelsData.error}`;
    return result;
  }
  
  result.wheelResultCount = wheelsData.results?.length || 0;
  result.debug.wheelsTotal = wheelsData.total;
  result.debug.wheelsFitmentClass = wheelsData.fitmentClass;
  
  // Extract typical width from results
  if (wheelsData.results && wheelsData.results.length > 0) {
    const widths = wheelsData.results.slice(0, 10).map(w => w.width).filter(Boolean);
    result.wheelWidth = widths.length > 0 ? `${Math.min(...widths)}-${Math.max(...widths)}"` : "N/A";
    
    // Check offset distribution
    const offsets = wheelsData.results.slice(0, 20).map(w => Number(w.offset)).filter(o => !isNaN(o));
    if (offsets.length > 0) {
      result.debug.actualOffsetRange = `${Math.min(...offsets)} to ${Math.max(...offsets)}`;
    }
  }
  
  // 4. Search tires with lifted params
  const tiresParams = new URLSearchParams({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    wheelDiameter: String(wheelDiameter),
    buildType: liftInches <= 2 ? "leveled" : "lifted",
    liftInches: String(liftInches),
    pageSize: "50",
  });
  if (modification) {
    tiresParams.set("modification", modification);
  }
  
  const tiresUrl = `${BASE_URL}/api/tires/search?${tiresParams}`;
  const tiresData = await fetchJson(tiresUrl);
  
  if (tiresData.error) {
    result.status = "FAIL";
    result.failureReason = `Tires API error: ${tiresData.error}`;
    return result;
  }
  
  result.tireResultCount = tiresData.results?.length || 0;
  result.debug.tiresMatchMode = tiresData.matchMode;
  result.debug.tiresSizesSearched = tiresData.sizesSearched;
  
  // Extract recommended tire size from results
  if (tiresData.results && tiresData.results.length > 0) {
    // Get the most common size from results
    const sizeCounts = {};
    tiresData.results.forEach(t => {
      const size = t.size || t.tireSize;
      if (size) {
        sizeCounts[size] = (sizeCounts[size] || 0) + 1;
      }
    });
    
    const topSize = Object.entries(sizeCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topSize) {
      result.recommendedTireSize = topSize[0];
      result.outerDiameter = extractTireDiameter(topSize[0]);
      result.stockSize = isStockTireSize(topSize[0], vehicle);
    }
  }
  
  // Also check sizes searched
  if (tiresData.sizesSearched && tiresData.sizesSearched.length > 0) {
    const firstSearchedSize = tiresData.sizesSearched[0];
    if (!result.recommendedTireSize) {
      result.recommendedTireSize = firstSearchedSize;
      result.outerDiameter = extractTireDiameter(firstSearchedSize);
      result.stockSize = isStockTireSize(firstSearchedSize, vehicle);
    }
    result.debug.searchedSizes = tiresData.sizesSearched.slice(0, 5).join(", ");
  }
  
  // 5. Validate results
  
  // Check: No wheels returned
  if (result.wheelResultCount === 0) {
    result.status = "FAIL";
    result.failureReason = "No wheel results";
  }
  
  // Check: No tires returned
  else if (result.tireResultCount === 0) {
    result.status = "FAIL";
    result.failureReason = "No tire results";
  }
  
  // Check: 6" lift recommends stock tire size
  else if (liftInches === 6 && result.stockSize) {
    result.status = "FAIL";
    result.failureReason = "6\" lift recommending stock tire size";
  }
  
  // Check: 4" lift recommends stock tire size
  else if (liftInches === 4 && result.stockSize) {
    result.status = "FAIL";
    result.failureReason = "4\" lift recommending stock tire size";
  }
  
  // Check: Tire diameter too small for lift
  else if (result.outerDiameter) {
    const minExpected = EXPECTED_MIN_TIRE_DIA[liftInches];
    if (result.outerDiameter < minExpected - 1) {
      result.status = "FAIL";
      result.failureReason = `Tire diameter ${result.outerDiameter}" too small for ${liftInches}" lift (expected ${minExpected}"+)`;
    }
  }
  
  // Check: Fallback to non-lifted logic
  if (tiresData.matchMode && tiresData.matchMode !== "lifted") {
    result.warnings.push(`Tire match mode is "${tiresData.matchMode}", not "lifted"`);
    if (!result.stockSize) {
      // Only fail if using stock sizes
    } else {
      result.status = "FAIL";
      result.failureReason = `Fell back to "${tiresData.matchMode}" mode with stock sizes`;
    }
  }
  
  return result;
}

async function runQASweep() {
  console.log("🔍 Lifted Package QA Sweep");
  console.log("═".repeat(120));
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Vehicles: ${VEHICLES.length}`);
  console.log(`Lift Heights: ${LIFT_HEIGHTS.join(", ")}`);
  console.log("");
  
  const results = [];
  
  for (const vehicle of VEHICLES) {
    for (const liftHeight of LIFT_HEIGHTS) {
      process.stdout.write(`Testing ${vehicle.year} ${vehicle.make} ${vehicle.model} @ ${liftHeight}"... `);
      const result = await testVehicleLift(vehicle, liftHeight);
      results.push(result);
      console.log(result.status === "PASS" ? "✅" : `❌ ${result.failureReason}`);
      
      // Delay to avoid hammering the API
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  
  // Print results table
  console.log("\n" + "═".repeat(120));
  console.log("RESULTS TABLE");
  console.log("═".repeat(120));
  
  // Header
  console.log(
    "Vehicle".padEnd(40) +
    "Lift".padEnd(6) +
    "Tire Size".padEnd(15) +
    "Dia".padEnd(6) +
    "Offset".padEnd(14) +
    "Wheels".padEnd(8) +
    "Tires".padEnd(8) +
    "Stock?".padEnd(8) +
    "Status".padEnd(8) +
    "Failure Reason"
  );
  console.log("-".repeat(120));
  
  for (const r of results) {
    console.log(
      r.vehicle.padEnd(40) +
      r.liftHeight.padEnd(6) +
      (r.recommendedTireSize || "N/A").padEnd(15) +
      (r.outerDiameter ? `${r.outerDiameter}"` : "N/A").padEnd(6) +
      (r.offsetRange || "N/A").padEnd(14) +
      String(r.wheelResultCount).padEnd(8) +
      String(r.tireResultCount).padEnd(8) +
      (r.stockSize ? "YES" : "no").padEnd(8) +
      r.status.padEnd(8) +
      (r.failureReason || "")
    );
  }
  
  // Summary
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  
  console.log("\n" + "═".repeat(120));
  console.log("SUMMARY");
  console.log("═".repeat(120));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  // List failures
  const failures = results.filter(r => r.status === "FAIL");
  if (failures.length > 0) {
    console.log("\nFAILURES:");
    for (const f of failures) {
      console.log(`  ❌ ${f.vehicle} @ ${f.liftHeight}: ${f.failureReason}`);
      if (f.debug.tiresMatchMode) {
        console.log(`     Match mode: ${f.debug.tiresMatchMode}`);
      }
      if (f.debug.searchedSizes) {
        console.log(`     Searched sizes: ${f.debug.searchedSizes}`);
      }
    }
  }
  
  // Warnings
  const withWarnings = results.filter(r => r.warnings.length > 0);
  if (withWarnings.length > 0) {
    console.log("\nWARNINGS:");
    for (const w of withWarnings) {
      console.log(`  ⚠️  ${w.vehicle} @ ${w.liftHeight}:`);
      for (const warning of w.warnings) {
        console.log(`     - ${warning}`);
      }
    }
  }
  
  // Write detailed results to JSON
  const outputPath = `results-lifted-qa-${Date.now()}.json`;
  const fs = await import("fs/promises");
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results written to: ${outputPath}`);
  
  // Save to database
  if (!DRY_RUN && DATABASE_URL) {
    console.log("\n📊 Saving to database...");
    try {
      await saveResultsToDatabase(results);
      console.log("✅ Results saved to database - view at /admin/qa");
    } catch (err) {
      console.error(`❌ Database error: ${err.message}`);
    }
  } else if (DRY_RUN) {
    console.log("\n⏭️  Skipping database save (--dry-run)");
  } else {
    console.log("\n⚠️  No POSTGRES_URL configured, skipping database save");
  }
}

/**
 * Save lifted QA results to database
 */
async function saveResultsToDatabase(results) {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    const runId = randomUUID();
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;
    const passRate = results.length > 0 ? Math.round((passed / results.length) * 10000) / 100 : 0;
    
    // Create run record
    await pool.query(`
      INSERT INTO qa_runs (
        run_id, started_at, completed_at, status, 
        vehicle_count, passed_count, failed_count, pass_rate,
        category_stats, base_url, trigger_source, notes
      ) VALUES (
        $1, NOW() - INTERVAL '1 minute', NOW(), 'completed',
        $2, $3, $4, $5,
        $6, $7, 'manual', 'Lifted Package QA'
      )
    `, [
      runId,
      results.length,
      passed,
      failed,
      passRate,
      JSON.stringify({ lifted: { total: results.length, passed, failed, passRate } }),
      BASE_URL,
    ]);
    
    console.log(`  Created run: ${runId}`);
    
    // Save individual results
    for (const r of results) {
      // Parse vehicle from string
      const vehicleMatch = r.vehicle.match(/^(\d{4})\s+(.+?)\s+(.+?)\s+(.+?)$/);
      const [, year, make, model, trim] = vehicleMatch || ['', '', '', '', ''];
      const liftInches = parseInt(r.liftHeight, 10);
      
      await pool.query(`
        INSERT INTO qa_results (
          run_id, year, make, model, trim, category,
          status, severity, failure_type, error_message,
          wheel_test_passed, wheel_count,
          tire_test_passed, tire_count,
          lifted_tests
        ) VALUES (
          $1, $2, $3, $4, $5, 'lifted',
          $6, $7, $8, $9,
          $10, $11,
          $12, $13,
          $14
        )
      `, [
        runId,
        parseInt(year, 10),
        make,
        model,
        trim,
        r.status === "PASS" ? "pass" : "fail",
        r.status === "FAIL" ? "high" : null,
        r.status === "FAIL" ? "lifted_config" : null,
        r.failureReason,
        r.wheelResultCount > 0,
        r.wheelResultCount,
        r.tireResultCount > 0,
        r.tireResultCount,
        JSON.stringify({
          liftHeight: liftInches,
          recommendedTireSize: r.recommendedTireSize,
          outerDiameter: r.outerDiameter,
          offsetRange: r.offsetRange,
          stockSize: r.stockSize,
          warnings: r.warnings,
          debug: r.debug,
        }),
      ]);
    }
    
    console.log(`  Saved ${results.length} results`);
  } finally {
    await pool.end();
  }
}

runQASweep().catch(console.error);
