/**
 * QA Sweep for Config-Backed Vehicles
 * 
 * Tests promoted vehicles to ensure:
 * 1. Single-config trims skip wheel-size gate
 * 2. Multi-config trims show correct behavior
 * 3. Deep links with wheelDia work
 * 4. No fallback to aggregated data
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

interface QAResult {
  vehicle: string;
  trim: string;
  modificationId: string | null;
  expectedDiameters: number[];
  expectedSkipGate: boolean;
  actualSource: string;
  actualUsedConfigTable: boolean;
  actualNeedsSelection: boolean;
  actualDiameters: number[];
  passed: boolean;
  issues: string[];
}

async function fetchAPI(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}&_cb=${Date.now()}`;
  const res = await fetch(url);
  return res.json();
}

async function getVehiclesToTest(): Promise<Array<{
  year: number;
  make: string;
  model: string;
  trim: string;
  modificationId: string | null;
  diameters: number[];
}>> {
  // Get unique vehicles from config table with their diameters
  const result = await pool.query(`
    SELECT 
      year, make_key, model_key, display_trim, modification_id,
      array_agg(DISTINCT wheel_diameter ORDER BY wheel_diameter) as diameters
    FROM vehicle_fitment_configurations
    WHERE year >= 2020
    GROUP BY year, make_key, model_key, display_trim, modification_id
    ORDER BY make_key, model_key, year, display_trim
  `);
  
  return result.rows.map((r: any) => ({
    year: r.year,
    make: r.make_key,
    model: r.model_key,
    trim: r.display_trim,
    modificationId: r.modification_id,
    diameters: r.diameters.map(Number),
  }));
}

async function findModificationId(year: number, make: string, model: string, trim: string): Promise<string | null> {
  // Find the modification_id from vehicle_fitments that matches this trim
  const result = await pool.query(`
    SELECT modification_id, display_trim
    FROM vehicle_fitments
    WHERE year = $1 AND make = $2 AND model = $3
    AND (
      display_trim = $4 
      OR display_trim ILIKE $5 
      OR display_trim ILIKE $6
    )
    LIMIT 1
  `, [year, make, model, trim, `${trim},%`, `%, ${trim},%`]);
  
  if (result.rows.length > 0) {
    return result.rows[0].modification_id;
  }
  
  // If no exact match, try to find any entry for this model
  const fallback = await pool.query(`
    SELECT modification_id, display_trim
    FROM vehicle_fitments
    WHERE year = $1 AND make = $2 AND model = $3
    LIMIT 1
  `, [year, make, model]);
  
  return fallback.rows[0]?.modification_id || null;
}

async function testVehicle(
  year: number,
  make: string,
  model: string,
  trim: string,
  expectedDiameters: number[],
  modificationId: string | null
): Promise<QAResult> {
  const vehicle = `${year} ${make} ${model}`;
  const issues: string[] = [];
  
  // If no modificationId from config, look it up
  const modId = modificationId || await findModificationId(year, make, model, trim);
  
  if (!modId) {
    return {
      vehicle,
      trim,
      modificationId: null,
      expectedDiameters,
      expectedSkipGate: expectedDiameters.length === 1,
      actualSource: "error",
      actualUsedConfigTable: false,
      actualNeedsSelection: false,
      actualDiameters: [],
      passed: false,
      issues: ["Could not find modification_id in vehicle_fitments"],
    };
  }

  // Test tire-sizes API - include trim parameter to help prioritize comma-separated trims
  const tireSizesUrl = `/api/vehicles/tire-sizes?year=${year}&make=${make}&model=${model}&modification=${modId}&trim=${encodeURIComponent(trim)}`;
  let tireSizesData: any;
  try {
    tireSizesData = await fetchAPI(tireSizesUrl);
  } catch (err) {
    return {
      vehicle,
      trim,
      modificationId: modId,
      expectedDiameters,
      expectedSkipGate: expectedDiameters.length === 1,
      actualSource: "error",
      actualUsedConfigTable: false,
      actualNeedsSelection: false,
      actualDiameters: [],
      passed: false,
      issues: [`API error: ${err}`],
    };
  }

  const actualSource = tireSizesData.source || "unknown";
  const actualNeedsSelection = tireSizesData.wheelDiameters?.needsSelection ?? true;
  const actualDiameters = tireSizesData.wheelDiameters?.available || [];
  const actualUsedConfigTable = actualSource === "config";
  const expectedSkipGate = expectedDiameters.length === 1;

  // Check 1: Should use config table
  if (actualSource !== "config") {
    issues.push(`Expected source=config, got source=${actualSource}`);
  }

  // Check 2: Gate behavior
  if (expectedSkipGate && actualNeedsSelection) {
    issues.push(`Single-diameter trim should skip gate (needsSelection=false), got needsSelection=true`);
  }
  if (!expectedSkipGate && !actualNeedsSelection) {
    issues.push(`Multi-diameter trim should show gate (needsSelection=true), got needsSelection=false`);
  }

  // Check 3: Diameters match
  const expectedSet = new Set(expectedDiameters);
  const actualSet = new Set(actualDiameters);
  if (expectedSet.size !== actualSet.size || ![...expectedSet].every(d => actualSet.has(d))) {
    issues.push(`Diameter mismatch: expected [${expectedDiameters}], got [${actualDiameters}]`);
  }

  return {
    vehicle,
    trim,
    modificationId: modId,
    expectedDiameters,
    expectedSkipGate,
    actualSource,
    actualUsedConfigTable,
    actualNeedsSelection,
    actualDiameters,
    passed: issues.length === 0,
    issues,
  };
}

async function testDeepLink(year: number, make: string, model: string, wheelDia: number, trim?: string): Promise<{passed: boolean; issue?: string}> {
  // If trim provided, try to find that specific modification
  let query = `SELECT modification_id, display_trim FROM vehicle_fitments WHERE year = $1 AND make = $2 AND model = $3`;
  const params: (string | number)[] = [year, make, model];
  
  if (trim) {
    query += ` AND (display_trim = $4 OR display_trim ILIKE $5)`;
    params.push(trim, `${trim},%`);
  }
  query += ` LIMIT 1`;
  
  const modResult = await pool.query(query, params);
  
  if (modResult.rows.length === 0) {
    return { passed: false, issue: `No modification_id found${trim ? ` for trim ${trim}` : ""}` };
  }
  
  const modId = modResult.rows[0].modification_id;
  const actualTrim = modResult.rows[0].display_trim;
  let url = `/api/vehicles/tire-sizes?year=${year}&make=${make}&model=${model}&modification=${modId}&wheelDia=${wheelDia}`;
  if (trim) {
    url += `&trim=${encodeURIComponent(trim)}`;
  }
  
  try {
    const data = await fetchAPI(url);
    // Deep link should still return config data
    if (data.source !== "config") {
      return { passed: false, issue: `Deep link returned source=${data.source}, expected config (trim: ${actualTrim})` };
    }
    return { passed: true };
  } catch (err) {
    return { passed: false, issue: `API error: ${err}` };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  QA SWEEP: Config-Backed Vehicles");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Base URL: ${BASE_URL}`);
  console.log("");

  // Priority vehicles to test
  const priorityVehicles = [
    { year: 2020, make: "toyota", model: "camry", trim: "LE" },
    { year: 2020, make: "honda", model: "accord", trim: "LX" },
    { year: 2022, make: "cadillac", model: "escalade", trim: "Luxury" },
    { year: 2022, make: "cadillac", model: "escalade", trim: "Sport" },
    { year: 2022, make: "gmc", model: "yukon", trim: "SLE" },
    { year: 2022, make: "gmc", model: "yukon", trim: "Denali" },
    { year: 2022, make: "ford", model: "expedition", trim: "XLT" },
    { year: 2022, make: "ram", model: "1500", trim: "Tradesman" },
    { year: 2022, make: "ram", model: "1500", trim: "Limited" },
  ];

  // Get config data for priority vehicles
  const configData = await pool.query(`
    SELECT 
      year, make_key, model_key, display_trim,
      array_agg(DISTINCT wheel_diameter ORDER BY wheel_diameter) as diameters
    FROM vehicle_fitment_configurations
    WHERE (year, make_key, model_key, display_trim) IN (
      ${priorityVehicles.map((_, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4})`).join(", ")}
    )
    GROUP BY year, make_key, model_key, display_trim
  `, priorityVehicles.flatMap(v => [v.year, v.make, v.model, v.trim]));

  const configMap = new Map<string, number[]>();
  configData.rows.forEach((r: any) => {
    const key = `${r.year}-${r.make_key}-${r.model_key}-${r.display_trim}`;
    configMap.set(key, r.diameters.map(Number));
  });

  console.log("Testing priority vehicles...\n");

  const results: QAResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const v of priorityVehicles) {
    const key = `${v.year}-${v.make}-${v.model}-${v.trim}`;
    const diameters = configMap.get(key);
    
    if (!diameters) {
      console.log(`⚠️  ${v.year} ${v.make} ${v.model} ${v.trim}: NO CONFIG DATA`);
      failed++;
      continue;
    }

    const result = await testVehicle(v.year, v.make, v.model, v.trim, diameters, null);
    results.push(result);

    if (result.passed) {
      console.log(`✅ ${result.vehicle} ${result.trim}: source=${result.actualSource}, needsSelection=${result.actualNeedsSelection}, diameters=[${result.actualDiameters}]`);
      passed++;
    } else {
      console.log(`❌ ${result.vehicle} ${result.trim}:`);
      result.issues.forEach(i => console.log(`   - ${i}`));
      failed++;
    }
  }

  // Test deep links - use specific trims that have config data
  // Tests that deep links with wheelDia still use config table
  console.log("\nTesting deep links...\n");
  const deepLinkTests = [
    { year: 2020, make: "toyota", model: "camry", wheelDia: 17, trim: "LE" },
    { year: 2022, make: "cadillac", model: "escalade", wheelDia: 22, trim: "Luxury" },
    // Note: wheelDia=24 is optional/upgrade, not default - testing it still returns config
    { year: 2022, make: "cadillac", model: "escalade", wheelDia: 24, trim: "Luxury" },
  ];

  for (const dl of deepLinkTests) {
    const result = await testDeepLink(dl.year, dl.make, dl.model, dl.wheelDia, dl.trim);
    if (result.passed) {
      console.log(`✅ Deep link: ${dl.year} ${dl.make} ${dl.model} ${dl.trim} wheelDia=${dl.wheelDia}`);
    } else {
      console.log(`❌ Deep link: ${dl.year} ${dl.make} ${dl.model} ${dl.trim} wheelDia=${dl.wheelDia}: ${result.issue}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);

  if (failed > 0) {
    console.log("\n  ⚠️  Some vehicles have issues - review above");
  } else {
    console.log("\n  ✅ All priority vehicles passing!");
  }

  await pool.end();
}

main().catch(console.error);
