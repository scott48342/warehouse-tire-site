/**
 * UX QA Sweep for Config-Driven Wheel Selection
 * 
 * Tests that config-backed vehicles:
 * 1. Skip blocking gate
 * 2. Auto-select default wheel diameter
 * 3. Show correct tire sizes based on default config
 * 4. Deep links work
 * 5. Non-config vehicles still work (fallback)
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

async function fetchAPI(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}&_cb=${Date.now()}`;
  const res = await fetch(url);
  return res.json();
}

interface TestResult {
  vehicle: string;
  trim: string;
  test: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const results: TestResult[] = [];

async function findModificationId(year: number, make: string, model: string, trim?: string): Promise<string | null> {
  // First try exact or prefix match
  let query = `SELECT modification_id, display_trim FROM vehicle_fitments WHERE year = $1 AND make = $2 AND model = $3`;
  const params: (string | number)[] = [year, make, model];
  
  if (trim) {
    // Match: exact, prefix, or contains in comma-separated list
    query += ` AND (display_trim = $4 OR display_trim ILIKE $5 OR display_trim ILIKE $6 OR display_trim ILIKE $7)`;
    params.push(trim, `${trim},%`, `%, ${trim},%`, `%, ${trim}`);
  }
  query += ` LIMIT 1`;
  
  const result = await pool.query(query, params);
  return result.rows[0]?.modification_id || null;
}

async function testConfigBacked() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  CONFIG-BACKED VEHICLES (Should auto-select + inline switcher)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const configVehicles = [
    { year: 2020, make: "toyota", model: "camry", trim: "LE", expectDia: 17 },
    { year: 2020, make: "honda", model: "accord", trim: "LX", expectDia: 16 },
    { year: 2022, make: "cadillac", model: "escalade", trim: "Luxury", expectDia: 22 },
    { year: 2022, make: "gmc", model: "yukon", trim: "Denali", expectDia: 22 },
    { year: 2022, make: "gmc", model: "yukon", trim: "SLE", expectDia: 18 },
    { year: 2022, make: "ram", model: "1500", trim: "Limited", expectDia: 22 },
    { year: 2022, make: "ford", model: "expedition", trim: "XLT", expectDia: 18 },
    { year: 2022, make: "ford", model: "expedition", trim: "Platinum", expectDia: 22 },
  ];

  for (const v of configVehicles) {
    const modId = await findModificationId(v.year, v.make, v.model, v.trim);
    
    if (!modId) {
      console.log(`⚠️  ${v.year} ${v.make} ${v.model} ${v.trim}: No modification_id found`);
      results.push({
        vehicle: `${v.year} ${v.make} ${v.model}`,
        trim: v.trim,
        test: "modification_id lookup",
        expected: "found",
        actual: "not found",
        passed: false,
      });
      continue;
    }

    // Test tire-sizes API
    const tireSizesUrl = `/api/vehicles/tire-sizes?year=${v.year}&make=${v.make}&model=${v.model}&modification=${modId}&trim=${encodeURIComponent(v.trim)}`;
    const data = await fetchAPI(tireSizesUrl);

    // Check 1: Uses config table
    const usesConfig = data.source === "config";
    console.log(`${usesConfig ? "✅" : "❌"} ${v.year} ${v.make} ${v.model} ${v.trim}: source=${data.source}`);
    results.push({
      vehicle: `${v.year} ${v.make} ${v.model}`,
      trim: v.trim,
      test: "uses config table",
      expected: "config",
      actual: data.source,
      passed: usesConfig,
    });

    // Check 2: Single diameter for single-config trims OR correct default for multi-config
    const needsSelection = data.wheelDiameters?.needsSelection;
    const defaultDia = data.wheelDiameters?.default;
    const availableDias = data.wheelDiameters?.available || [];
    
    if (availableDias.length === 1) {
      // Single config - should NOT need selection
      const correctSingleConfig = !needsSelection && availableDias[0] === v.expectDia;
      console.log(`  ${correctSingleConfig ? "✅" : "❌"} Single config: needsSelection=${needsSelection}, dia=${availableDias[0]} (expected ${v.expectDia})`);
      results.push({
        vehicle: `${v.year} ${v.make} ${v.model}`,
        trim: v.trim,
        test: "single config behavior",
        expected: `needsSelection=false, dia=${v.expectDia}`,
        actual: `needsSelection=${needsSelection}, dia=${availableDias[0]}`,
        passed: correctSingleConfig,
      });
    } else if (availableDias.length > 1) {
      // Multi config - should have default
      const correctMultiConfig = defaultDia === v.expectDia || availableDias.includes(v.expectDia);
      console.log(`  ${correctMultiConfig ? "✅" : "❌"} Multi config: default=${defaultDia}, available=[${availableDias}] (expected ${v.expectDia})`);
      results.push({
        vehicle: `${v.year} ${v.make} ${v.model}`,
        trim: v.trim,
        test: "multi config behavior",
        expected: `default=${v.expectDia} in [${availableDias}]`,
        actual: `default=${defaultDia}, available=[${availableDias}]`,
        passed: correctMultiConfig,
      });
    }
  }
}

async function testDeepLinks() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  DEEP LINKS (wheelDia param should work)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const deepLinkTests = [
    { year: 2020, make: "toyota", model: "camry", trim: "LE", wheelDia: 17 },
    { year: 2022, make: "cadillac", model: "escalade", trim: "Luxury", wheelDia: 22 },
    { year: 2022, make: "cadillac", model: "escalade", trim: "Luxury", wheelDia: 24 }, // Optional size
  ];

  for (const t of deepLinkTests) {
    const modId = await findModificationId(t.year, t.make, t.model, t.trim);
    if (!modId) continue;

    const url = `/api/vehicles/tire-sizes?year=${t.year}&make=${t.make}&model=${t.model}&modification=${modId}&trim=${encodeURIComponent(t.trim)}&wheelDia=${t.wheelDia}`;
    const data = await fetchAPI(url);

    const passed = data.source === "config" && data.tireSizes?.length > 0;
    console.log(`${passed ? "✅" : "❌"} ${t.year} ${t.make} ${t.model} ${t.trim} wheelDia=${t.wheelDia}: source=${data.source}, sizes=${data.tireSizes?.length || 0}`);
    results.push({
      vehicle: `${t.year} ${t.make} ${t.model}`,
      trim: t.trim,
      test: `deep link wheelDia=${t.wheelDia}`,
      expected: "source=config, tireSizes>0",
      actual: `source=${data.source}, tireSizes=${data.tireSizes?.length || 0}`,
      passed,
    });
  }
}

async function testNonConfigFallback() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  NON-CONFIG VEHICLES (Should use legacy/db-first)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Vehicles without config data
  const nonConfigVehicles = [
    { year: 2020, make: "bmw", model: "3-series" },
    { year: 2021, make: "audi", model: "a4" },
  ];

  for (const v of nonConfigVehicles) {
    const modId = await findModificationId(v.year, v.make, v.model);
    if (!modId) {
      console.log(`⚠️  ${v.year} ${v.make} ${v.model}: No modification_id found (skipping)`);
      continue;
    }

    const url = `/api/vehicles/tire-sizes?year=${v.year}&make=${v.make}&model=${v.model}&modification=${modId}`;
    const data = await fetchAPI(url);

    // Should NOT use config table (no data for these)
    const usesLegacy = data.source === "db-first" || data.source === "legacy" || data.source === "tire-direct";
    console.log(`${usesLegacy ? "✅" : "⚠️ "} ${v.year} ${v.make} ${v.model}: source=${data.source}`);
    results.push({
      vehicle: `${v.year} ${v.make} ${v.model}`,
      trim: "any",
      test: "non-config fallback",
      expected: "source=db-first or legacy",
      actual: `source=${data.source}`,
      passed: usesLegacy,
    });
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  UX QA SWEEP: Config-Driven Wheel Selection");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Base URL: ${BASE_URL}`);

  await testConfigBacked();
  await testDeepLinks();
  await testNonConfigFallback();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${results.length}`);

  if (failed > 0) {
    console.log("\n  ❌ FAILED TESTS:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`     - ${r.vehicle} ${r.trim}: ${r.test}`);
      console.log(`       Expected: ${r.expected}`);
      console.log(`       Actual:   ${r.actual}`);
    });
  } else {
    console.log("\n  ✅ All tests passed!");
  }

  await pool.end();
}

main().catch(console.error);
