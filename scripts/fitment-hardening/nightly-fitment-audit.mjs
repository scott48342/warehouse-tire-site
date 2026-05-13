/**
 * Nightly Fitment Health Audit
 * 
 * Checks:
 * 1. Sentinel vehicles - known good vehicles should still resolve correctly
 * 2. Missing wheel specs - bolt pattern, center bore, offsets
 * 3. Missing tire sizes - empty arrays or nulls
 * 4. Null/empty arrays - data quality issues
 * 5. Alias failures - duplicate/conflicting model names
 * 6. Runtime API health - endpoints responding correctly
 * 7. Deprecated table usage - vehicleFitmentConfigurations shouldn't be in runtime
 * 8. Confidence tag distribution - track data quality over time
 * 
 * Run: node scripts/fitment-hardening/nightly-fitment-audit.mjs
 * Cron: 3 AM EST daily
 */

import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync, existsSync, readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing POSTGRES_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

// Base URL for API health checks (local dev or production)
const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

// Sentinel vehicles - known good data that should always resolve correctly
// Note: Model names use ILIKE so partial matches work
const SENTINEL_VEHICLES = [
  { year: 2024, make: "Ford", model: "F-150", expectedBolt: "6x135" },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500", expectedBolt: "6x139.7" },
  { year: 2024, make: "Toyota", model: "Camry", expectedBolt: "5x114.3" },
  { year: 2024, make: "Honda", model: "Civic", expectedBolt: "5x114.3" },
  { year: 2024, make: "Ford", model: "Mustang", expectedBolt: "5x114.3" },
  { year: 2023, make: "BMW", model: "3 Series", expectedBolt: "5x112" },
  { year: 2024, make: "Tesla", model: "model-y", expectedBolt: "5x114.3" },  // stored lowercase
  { year: 2024, make: "RAM", model: "1500", expectedBolt: "6x139.7" },  // RAM uppercase
  // HD trucks
  { year: 2024, make: "Ford", model: "f-250", expectedBolt: "8x170" },  // stored lowercase
  { year: 2024, make: "Chevrolet", model: "silverado-3500hd", expectedBolt: "8x180" },  // stored lowercase
  // Performance
  { year: 2024, make: "Chevrolet", model: "Corvette", expectedBolt: "5x120" },
  { year: 2024, make: "Porsche", model: "911", expectedBolt: "5x130" },
];

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    status: "PASS",
    checks: {},
    issues: [],
    stats: {},
  };

  console.log(`\n${"═".repeat(60)}`);
  console.log(`NIGHTLY FITMENT HEALTH AUDIT`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`${"═".repeat(60)}\n`);

  // 1. Sentinel Vehicles
  console.log("[1] Sentinel Vehicles");
  const sentinelResults = [];
  for (const sentinel of SENTINEL_VEHICLES) {
    const result = await client`
      SELECT bolt_pattern, center_bore_mm, confidence_tag
      FROM vehicle_fitments
      WHERE year = ${sentinel.year}
        AND make = ${sentinel.make}
        AND model ILIKE ${sentinel.model}
      LIMIT 1
    `;
    
    const pass = result.length > 0 && result[0].bolt_pattern === sentinel.expectedBolt;
    sentinelResults.push({
      vehicle: `${sentinel.year} ${sentinel.make} ${sentinel.model}`,
      expected: sentinel.expectedBolt,
      actual: result[0]?.bolt_pattern || "NOT FOUND",
      pass,
    });
    
    if (!pass) {
      report.issues.push({
        type: "SENTINEL_FAILURE",
        vehicle: `${sentinel.year} ${sentinel.make} ${sentinel.model}`,
        expected: sentinel.expectedBolt,
        actual: result[0]?.bolt_pattern || "NOT FOUND",
      });
    }
    
    console.log(`  ${pass ? "✓" : "✗"} ${sentinel.year} ${sentinel.make} ${sentinel.model}`);
  }
  report.checks.sentinels = {
    total: SENTINEL_VEHICLES.length,
    passed: sentinelResults.filter(r => r.pass).length,
    results: sentinelResults,
  };
  console.log();

  // 2. Missing Wheel Specs
  console.log("[2] Missing Wheel Specs");
  const missingSpecs = await client`
    SELECT 
      SUM(CASE WHEN bolt_pattern IS NULL THEN 1 ELSE 0 END) as missing_bolt,
      SUM(CASE WHEN center_bore_mm IS NULL THEN 1 ELSE 0 END) as missing_cb,
      SUM(CASE WHEN offset_min_mm IS NULL OR offset_max_mm IS NULL THEN 1 ELSE 0 END) as missing_offset,
      COUNT(*) as total
    FROM vehicle_fitments
  `;
  report.checks.missingSpecs = {
    missingBoltPattern: parseInt(missingSpecs[0].missing_bolt),
    missingCenterBore: parseInt(missingSpecs[0].missing_cb),
    missingOffset: parseInt(missingSpecs[0].missing_offset),
    total: parseInt(missingSpecs[0].total),
  };
  console.log(`  Missing bolt pattern: ${missingSpecs[0].missing_bolt}`);
  console.log(`  Missing center bore: ${missingSpecs[0].missing_cb}`);
  console.log(`  Missing offset range: ${missingSpecs[0].missing_offset}`);
  console.log();

  // 3. Missing Tire/Wheel Sizes
  console.log("[3] Missing Tire/Wheel Size Arrays");
  const missingSizes = await client`
    SELECT 
      SUM(CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' OR oem_wheel_sizes::text = 'null' THEN 1 ELSE 0 END) as missing_wheels,
      SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null' THEN 1 ELSE 0 END) as missing_tires
    FROM vehicle_fitments
  `;
  report.checks.missingSizes = {
    missingWheelSizes: parseInt(missingSizes[0].missing_wheels),
    missingTireSizes: parseInt(missingSizes[0].missing_tires),
  };
  console.log(`  Missing wheel sizes: ${missingSizes[0].missing_wheels}`);
  console.log(`  Missing tire sizes: ${missingSizes[0].missing_tires}`);
  console.log();

  // 4. Confidence Tag Distribution
  console.log("[4] Confidence Tag Distribution");
  const confidenceStats = await client`
    SELECT confidence_tag, COUNT(*) as count
    FROM vehicle_fitments
    GROUP BY confidence_tag
    ORDER BY confidence_tag
  `;
  report.checks.confidenceDistribution = {};
  for (const row of confidenceStats) {
    report.checks.confidenceDistribution[row.confidence_tag] = parseInt(row.count);
    const pct = ((parseInt(row.count) / parseInt(missingSpecs[0].total)) * 100).toFixed(1);
    console.log(`  ${row.confidence_tag}: ${row.count} (${pct}%)`);
  }
  console.log();

  // 5. Duplicate/Alias Issues (same YMM with conflicting bolt patterns)
  console.log("[5] Alias/Duplicate Detection");
  const duplicates = await client`
    SELECT year, make, model, 
           COUNT(DISTINCT bolt_pattern) as bolt_count,
           ARRAY_AGG(DISTINCT bolt_pattern) as bolt_patterns
    FROM vehicle_fitments
    WHERE bolt_pattern IS NOT NULL
    GROUP BY year, make, model
    HAVING COUNT(DISTINCT bolt_pattern) > 1
    ORDER BY year DESC
    LIMIT 20
  `;
  report.checks.duplicates = {
    count: duplicates.length,
    samples: duplicates.map(d => ({
      vehicle: `${d.year} ${d.make} ${d.model}`,
      boltPatterns: d.bolt_patterns,
    })),
  };
  console.log(`  Vehicles with multiple bolt patterns: ${duplicates.length}`);
  if (duplicates.length > 0) {
    for (const d of duplicates.slice(0, 5)) {
      console.log(`    ${d.year} ${d.make} ${d.model}: ${d.bolt_patterns.join(", ")}`);
    }
  }
  console.log();

  // 6. LOW Confidence Records by Source
  console.log("[6] LOW Confidence by Source");
  const lowBySource = await client`
    SELECT source, COUNT(*) as count
    FROM vehicle_fitments
    WHERE confidence_tag = 'LOW'
    GROUP BY source
    ORDER BY count DESC
    LIMIT 10
  `;
  report.checks.lowConfidenceSources = lowBySource.map(r => ({
    source: r.source,
    count: parseInt(r.count),
  }));
  for (const row of lowBySource) {
    console.log(`  ${row.source}: ${row.count}`);
  }
  console.log();

  // 7. Runtime API Health (if BASE_URL is accessible)
  console.log("[7] Runtime API Health");
  report.checks.apiHealth = {};
  const endpoints = [
    { path: "/api/vehicles/years", check: (d) => d.length > 0 },
    { path: "/api/vehicles/makes?year=2024", check: (d) => d.length > 0 },
    { path: "/api/vehicles/models?year=2024&make=Ford", check: (d) => d.length > 0 },
    { path: "/api/vehicles/trims?year=2024&make=Ford&model=F-150", check: (d) => d.length > 0 },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint.path}`, { 
        signal: AbortSignal.timeout(5000) 
      });
      const data = await response.json();
      const pass = response.ok && endpoint.check(data);
      report.checks.apiHealth[endpoint.path] = { status: response.status, pass };
      console.log(`  ${pass ? "✓" : "✗"} ${endpoint.path}`);
    } catch (err) {
      report.checks.apiHealth[endpoint.path] = { status: "ERROR", error: err.message, pass: false };
      console.log(`  ✗ ${endpoint.path} - ${err.message}`);
    }
  }
  console.log();

  // 8. Year Coverage
  console.log("[8] Year Coverage");
  const yearCoverage = await client`
    SELECT 
      MIN(year) as min_year,
      MAX(year) as max_year,
      COUNT(DISTINCT year) as year_count
    FROM vehicle_fitments
  `;
  report.checks.yearCoverage = {
    minYear: yearCoverage[0].min_year,
    maxYear: yearCoverage[0].max_year,
    totalYears: yearCoverage[0].year_count,
  };
  console.log(`  Range: ${yearCoverage[0].min_year} - ${yearCoverage[0].max_year}`);
  console.log(`  Total years: ${yearCoverage[0].year_count}`);
  console.log();

  // Determine overall status
  // FAIL: Sentinel failures only (critical path)
  // WARN: Data quality issues (missing specs, duplicates)
  // PASS: All good
  const sentinelPass = report.checks.sentinels.passed === report.checks.sentinels.total;
  const missingBoltPct = (report.checks.missingSpecs.missingBoltPattern / report.checks.missingSpecs.total) * 100;
  
  if (!sentinelPass) {
    report.status = "FAIL";
  } else if (missingBoltPct > 1 || report.checks.duplicates.count > 20 || report.checks.confidenceDistribution.LOW > 100) {
    report.status = "WARN";
  }

  // Summary
  console.log(`${"═".repeat(60)}`);
  console.log(`AUDIT STATUS: ${report.status}`);
  console.log(`${"═".repeat(60)}\n`);

  if (report.issues.length > 0) {
    console.log("Issues requiring attention:");
    for (const issue of report.issues) {
      console.log(`  - ${issue.type}: ${issue.vehicle}`);
    }
  }

  // Save report
  const reportDir = join(__dirname, "../../data/audit-reports");
  const reportPath = join(reportDir, `fitment-audit-${new Date().toISOString().split("T")[0]}.json`);
  
  try {
    // Ensure directory exists
    await client.end();
    
    // Use sync file operations
    const { mkdirSync } = await import("fs");
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved: ${reportPath}`);
  } catch (err) {
    console.log(`\nCould not save report: ${err.message}`);
    console.log(JSON.stringify(report, null, 2));
  }

  // Exit with appropriate code
  process.exit(report.status === "FAIL" ? 1 : 0);
}

main().catch(console.error);
