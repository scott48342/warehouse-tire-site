/**
 * 100-Vehicle Fitment QA Audit
 * 
 * Tests diverse vehicle mix across all categories:
 * - 35 normal daily-driver vehicles
 * - 15 trucks/SUVs
 * - 10 lifted/off-road candidates
 * - 15 staggered/performance vehicles
 * - 10 HD/commercial vehicles
 * - 10 EV/hybrid vehicles
 * - 5 older/edge-case vehicles
 * 
 * NO DB WRITES - Audit only
 */

import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing POSTGRES_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 3 });
const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

// Test results
const results = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  vehicles: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    byCategory: {},
    byFailureType: {},
  },
};

// Fetch with timeout
async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Test a single vehicle
async function testVehicle(vehicle, category) {
  const result = {
    id: vehicle.id,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.display_trim,
    category,
    boltPattern: vehicle.bolt_pattern,
    centerBore: vehicle.center_bore_mm,
    confidenceTag: vehicle.confidence_tag,
    source: vehicle.source,
    tests: {},
    passed: true,
    failures: [],
  };

  // 1. YMM Selector Visibility - check makes endpoint
  try {
    const makesRes = await fetchWithTimeout(`${BASE_URL}/api/vehicles/makes?year=${vehicle.year}`);
    const makesData = await makesRes.json();
    // API returns { results: [...] } or just [...]
    const makes = makesData.results || makesData;
    const makeFound = Array.isArray(makes) && makes.some(m => {
      const makeStr = typeof m === 'string' ? m : m.make || m.name;
      return makeStr?.toLowerCase() === vehicle.make?.toLowerCase();
    });
    result.tests.ymmVisibility = { pass: makeFound, status: makesRes.status };
    if (!makeFound) {
      result.passed = false;
      result.failures.push("YMM_MAKE_NOT_FOUND");
    }
  } catch (err) {
    result.tests.ymmVisibility = { pass: false, error: err.message };
    result.passed = false;
    result.failures.push("YMM_API_ERROR");
  }

  // 2. Trims endpoint
  try {
    const trimsRes = await fetchWithTimeout(
      `${BASE_URL}/api/vehicles/trims?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`
    );
    const trimsData = await trimsRes.json();
    // API returns { results: [...] } or { trims: [...] }
    const trims = trimsData.results || trimsData.trims || trimsData;
    const hasTrims = Array.isArray(trims) && trims.length > 0;
    result.tests.trimsEndpoint = { pass: hasTrims, count: trims?.length || 0, status: trimsRes.status };
    if (!hasTrims) {
      result.passed = false;
      result.failures.push("NO_TRIMS_RETURNED");
    }
  } catch (err) {
    result.tests.trimsEndpoint = { pass: false, error: err.message };
    result.passed = false;
    result.failures.push("TRIMS_API_ERROR");
  }

  // 3. Tire sizes endpoint
  try {
    const tireSizesRes = await fetchWithTimeout(
      `${BASE_URL}/api/vehicles/tire-sizes?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&trim=${encodeURIComponent(vehicle.display_trim)}`
    );
    const tireSizesData = await tireSizesRes.json();
    // API returns { results: [...] } or { tireSizes: [...] } or { sizes: [...] }
    const tireSizes = tireSizesData.results || tireSizesData.tireSizes || tireSizesData.sizes || tireSizesData;
    const hasTireSizes = Array.isArray(tireSizes) && tireSizes.length > 0;
    result.tests.tireSizesEndpoint = { 
      pass: hasTireSizes, 
      count: tireSizes?.length || 0, 
      sizes: tireSizes?.slice?.(0, 5),
      status: tireSizesRes.status,
      isStaggered: tireSizesData.isStaggered,
    };
    if (!hasTireSizes) {
      result.passed = false;
      result.failures.push("NO_TIRE_SIZES");
    }
    
    // Check for staggered metadata
    if (category === "staggered") {
      const hasStaggeredData = tireSizesData.isStaggered || 
        tireSizes?.some?.(s => s.axle === "front" || s.axle === "rear" || s.position);
      result.tests.staggeredMetadata = { pass: hasStaggeredData };
      if (!hasStaggeredData) {
        result.failures.push("STAGGERED_METADATA_MISSING");
      }
    }
  } catch (err) {
    result.tests.tireSizesEndpoint = { pass: false, error: err.message };
    result.passed = false;
    result.failures.push("TIRE_SIZES_API_ERROR");
  }

  // 4. Wheel fitment search
  try {
    const wheelFitmentRes = await fetchWithTimeout(
      `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&trim=${encodeURIComponent(vehicle.display_trim)}`
    );
    const wheelData = await wheelFitmentRes.json();
    
    // Extract fitment data from various response locations
    // API returns fitment.envelope.boltPattern, fitment.envelope.centerBore, fitment.staggered.isStaggered
    const fitment = wheelData.fitment || {};
    const envelope = fitment.envelope || {};
    const dbProfile = fitment.dbProfile || {};
    
    const hasBoltPattern = envelope.boltPattern || dbProfile.boltPattern || wheelData.boltPattern;
    const hasCenterBore = envelope.centerBore || dbProfile.centerBoreMm || wheelData.centerBore;
    const hasWheels = wheelData.results?.length > 0 || wheelData.wheels?.length > 0;
    const isStaggered = fitment.staggered?.isStaggered || wheelData.isStaggered;
    const fitmentSource = fitment.fitmentSource || wheelData.source;
    const resolutionPath = fitment.resolutionPath || wheelData.resolutionPath;
    
    result.tests.wheelFitmentSearch = {
      pass: Boolean(hasBoltPattern),
      boltPattern: hasBoltPattern,
      centerBore: hasCenterBore,
      wheelCount: wheelData.results?.length || wheelData.totalCount || 0,
      isStaggered,
      fitmentSource,
      resolutionPath,
      confidence: fitment.confidence,
      status: wheelFitmentRes.status,
    };
    
    if (!hasBoltPattern) {
      result.passed = false;
      result.failures.push("NO_BOLT_PATTERN");
    }
    if (!hasCenterBore && category !== "older") {
      result.failures.push("NO_CENTER_BORE");
    }
    
    // Check for staggered (only fail if vehicle should be staggered but isn't)
    if (category === "staggered" && !isStaggered) {
      // Don't fail - some performance vehicles have optional staggered
      result.failures.push("STAGGERED_FLAG_MISSING");
    }
    
    // Check for deprecated config usage
    if (fitmentSource?.includes("config") || fitmentSource?.includes("deprecated")) {
      result.passed = false;
      result.failures.push("DEPRECATED_CONFIG_USAGE");
    }
    
    // Check for static fallback (warn only)
    if (fitmentSource?.includes("static") || fitmentSource?.includes("fallback")) {
      result.failures.push("STATIC_FALLBACK_USED");
    }
    
    // Check resolution path
    if (resolutionPath === "fallback" || resolutionPath === "static") {
      result.failures.push("NON_DB_RESOLUTION");
    }
  } catch (err) {
    result.tests.wheelFitmentSearch = { pass: false, error: err.message };
    result.passed = false;
    result.failures.push("WHEEL_FITMENT_API_ERROR");
  }

  // 5. Tire results for primary OEM size
  if (vehicle.oem_tire_sizes && vehicle.oem_tire_sizes.length > 0) {
    const primarySize = typeof vehicle.oem_tire_sizes[0] === 'string' 
      ? vehicle.oem_tire_sizes[0] 
      : vehicle.oem_tire_sizes[0]?.size || vehicle.oem_tire_sizes[0];
    
    if (primarySize && typeof primarySize === 'string') {
      try {
        const tireSearchRes = await fetchWithTimeout(
          `${BASE_URL}/api/tires/search?size=${encodeURIComponent(primarySize)}&limit=5`
        );
        const tireData = await tireSearchRes.json();
        const hasTires = tireData.tires?.length > 0 || tireData.results?.length > 0;
        result.tests.tireResults = {
          pass: tireSearchRes.status === 200,
          size: primarySize,
          count: tireData.tires?.length || tireData.results?.length || 0,
          status: tireSearchRes.status,
        };
        
        // HD vehicles should have LT sizes
        if (category === "hd" && !primarySize.startsWith("LT")) {
          result.failures.push("HD_MISSING_LT_SIZE");
        }
      } catch (err) {
        result.tests.tireResults = { pass: false, error: err.message };
        result.failures.push("TIRE_SEARCH_API_ERROR");
      }
    }
  }

  // 6. Check DB source (should be vehicle_fitments, not deprecated tables)
  result.tests.dbSource = {
    pass: vehicle.source && !vehicle.source.includes("deprecated"),
    source: vehicle.source,
  };

  // 7. Check for complete specs
  result.tests.specCompleteness = {
    hasBoltPattern: Boolean(vehicle.bolt_pattern),
    hasCenterBore: Boolean(vehicle.center_bore_mm),
    hasOffsetRange: Boolean(vehicle.offset_min_mm !== null && vehicle.offset_max_mm !== null),
    hasWheelSizes: Boolean(vehicle.oem_wheel_sizes?.length > 0),
    hasTireSizes: Boolean(vehicle.oem_tire_sizes?.length > 0),
  };

  return result;
}

async function main() {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`100-VEHICLE FITMENT QA AUDIT`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`${"═".repeat(70)}\n`);

  // Check if API is accessible
  try {
    const healthCheck = await fetchWithTimeout(`${BASE_URL}/api/vehicles/years`, 5000);
    if (!healthCheck.ok) {
      console.error(`⚠️  API returned ${healthCheck.status}. Make sure dev server is running.`);
    }
  } catch (err) {
    console.error(`❌ Cannot reach API at ${BASE_URL}`);
    console.error(`   Start dev server: npm run dev`);
    console.error(`   Or set BASE_URL env var to production URL`);
    await client.end();
    process.exit(1);
  }

  // Gather vehicles by category
  console.log("Selecting test vehicles...\n");

  // 1. Normal daily-drivers (35) - diverse makes, 2015-2024
  // Exclude consolidated records (those with commas in display_trim)
  const normalVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE confidence_tag IN ('HIGH', 'MEDIUM')
      AND bolt_pattern IS NOT NULL
      AND make IN ('Toyota', 'Honda', 'Ford', 'Chevrolet', 'Hyundai', 'Kia', 'Nissan', 'Mazda', 'Subaru', 'Volkswagen')
      AND model NOT ILIKE '%truck%' AND model NOT ILIKE '%van%'
      AND year BETWEEN 2015 AND 2024
      AND display_trim NOT LIKE '%,%'
    ORDER BY RANDOM()
    LIMIT 35
  `;
  console.log(`  ✓ Normal vehicles: ${normalVehicles.length}`);

  // 2. Trucks/SUVs (15)
  const truckSuvVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE confidence_tag IN ('HIGH', 'MEDIUM')
      AND bolt_pattern IS NOT NULL
      AND (
        model ILIKE '%F-150%' OR model ILIKE '%Silverado%' OR model ILIKE '%Sierra%'
        OR model ILIKE '%Tacoma%' OR model ILIKE '%Ranger%' OR model ILIKE '%Colorado%'
        OR model ILIKE '%4Runner%' OR model ILIKE '%Explorer%' OR model ILIKE '%Tahoe%'
        OR model ILIKE '%Highlander%' OR model ILIKE '%Pilot%' OR model ILIKE '%Pathfinder%'
        OR model ILIKE '%Wrangler%' OR model ILIKE '%Bronco%' OR model ILIKE '%Cherokee%'
      )
      AND model NOT ILIKE '%2500%' AND model NOT ILIKE '%3500%'
      AND year BETWEEN 2018 AND 2026
    ORDER BY RANDOM()
    LIMIT 15
  `;
  console.log(`  ✓ Trucks/SUVs: ${truckSuvVehicles.length}`);

  // 3. Lifted/Off-road candidates (10)
  const liftedVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND (
        model ILIKE '%Wrangler%' OR model ILIKE '%Gladiator%' 
        OR model ILIKE '%4Runner%' OR model ILIKE '%Tacoma%'
        OR model ILIKE '%Bronco%' OR model ILIKE '%Raptor%'
        OR model ILIKE '%TRD%' OR model ILIKE '%Trail%'
        OR (make = 'Jeep' AND model NOT ILIKE '%Compass%' AND model NOT ILIKE '%Renegade%')
      )
      AND year BETWEEN 2015 AND 2026
    ORDER BY RANDOM()
    LIMIT 10
  `;
  console.log(`  ✓ Lifted/Off-road: ${liftedVehicles.length}`);

  // 4. Staggered/Performance (15)
  const staggeredVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND (
        model ILIKE '%Mustang%' OR model ILIKE '%Camaro%' OR model ILIKE '%Corvette%'
        OR model ILIKE '%Challenger%' OR model ILIKE '%Charger%'
        OR model ILIKE '%911%' OR model ILIKE '%Cayman%' OR model ILIKE '%Boxster%'
        OR model ILIKE '%M3%' OR model ILIKE '%M4%' OR model ILIKE '%M5%'
        OR model ILIKE '%AMG%' OR model ILIKE '%RS%'
        OR make IN ('Ferrari', 'Lamborghini', 'McLaren', 'Aston Martin')
      )
      AND year BETWEEN 2015 AND 2026
    ORDER BY RANDOM()
    LIMIT 15
  `;
  console.log(`  ✓ Staggered/Performance: ${staggeredVehicles.length}`);

  // 5. HD/Commercial (10)
  const hdVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND (
        model ILIKE '%2500%' OR model ILIKE '%3500%'
        OR model ILIKE '%Super Duty%' OR model ILIKE '%HD%'
        OR model ILIKE '%ProMaster%' OR model ILIKE '%Transit%' OR model ILIKE '%Sprinter%'
      )
      AND year BETWEEN 2015 AND 2026
    ORDER BY RANDOM()
    LIMIT 10
  `;
  console.log(`  ✓ HD/Commercial: ${hdVehicles.length}`);

  // 6. EV/Hybrid (10)
  const evVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND (
        make = 'Tesla'
        OR model ILIKE '%Electric%' OR model ILIKE '%EV%' OR model ILIKE '%Bolt%'
        OR model ILIKE '%Leaf%' OR model ILIKE '%Prius%' OR model ILIKE '%Ioniq%'
        OR model ILIKE '%Mach-E%' OR model ILIKE '%Lightning%' OR model ILIKE '%Rivian%'
        OR model ILIKE '%ID.4%' OR model ILIKE '%e-tron%' OR model ILIKE '%i4%'
      )
      AND year BETWEEN 2018 AND 2026
    ORDER BY RANDOM()
    LIMIT 10
  `;
  console.log(`  ✓ EV/Hybrid: ${evVehicles.length}`);

  // 7. Older/Edge-case (5)
  const olderVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND year BETWEEN 2000 AND 2009
      AND display_trim NOT LIKE '%,%'
    ORDER BY RANDOM()
    LIMIT 5
  `;
  console.log(`  ✓ Older vehicles: ${olderVehicles.length}`);

  // Combine all vehicles
  const allVehicles = [
    ...normalVehicles.map(v => ({ ...v, category: "normal" })),
    ...truckSuvVehicles.map(v => ({ ...v, category: "truck_suv" })),
    ...liftedVehicles.map(v => ({ ...v, category: "lifted" })),
    ...staggeredVehicles.map(v => ({ ...v, category: "staggered" })),
    ...hdVehicles.map(v => ({ ...v, category: "hd" })),
    ...evVehicles.map(v => ({ ...v, category: "ev" })),
    ...olderVehicles.map(v => ({ ...v, category: "older" })),
  ];

  console.log(`\nTotal vehicles to test: ${allVehicles.length}\n`);
  console.log(`${"─".repeat(70)}`);
  console.log(`Running tests...`);
  console.log(`${"─".repeat(70)}\n`);

  // Test each vehicle
  let tested = 0;
  for (const vehicle of allVehicles) {
    tested++;
    process.stdout.write(`\r  Testing ${tested}/${allVehicles.length}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`.padEnd(70));
    
    try {
      const result = await testVehicle(vehicle, vehicle.category);
      results.vehicles.push(result);
      
      // Update summary
      results.summary.total++;
      if (result.passed) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
      
      // Track by category
      if (!results.summary.byCategory[vehicle.category]) {
        results.summary.byCategory[vehicle.category] = { total: 0, passed: 0, failed: 0 };
      }
      results.summary.byCategory[vehicle.category].total++;
      if (result.passed) {
        results.summary.byCategory[vehicle.category].passed++;
      } else {
        results.summary.byCategory[vehicle.category].failed++;
      }
      
      // Track failure types
      for (const failure of result.failures) {
        results.summary.byFailureType[failure] = (results.summary.byFailureType[failure] || 0) + 1;
      }
      
      // Small delay to avoid hammering API
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`\n  Error testing ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${err.message}`);
    }
  }

  console.log(`\n\n${"═".repeat(70)}`);
  console.log(`AUDIT RESULTS`);
  console.log(`${"═".repeat(70)}\n`);

  // Summary
  console.log(`SUMMARY:`);
  console.log(`  Total: ${results.summary.total}`);
  console.log(`  Passed: ${results.summary.passed} (${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${results.summary.failed} (${((results.summary.failed / results.summary.total) * 100).toFixed(1)}%)`);

  console.log(`\nBY CATEGORY:`);
  for (const [cat, stats] of Object.entries(results.summary.byCategory)) {
    const pct = ((stats.passed / stats.total) * 100).toFixed(0);
    console.log(`  ${cat.padEnd(15)} ${stats.passed}/${stats.total} (${pct}%)`);
  }

  console.log(`\nFAILURE TYPES:`);
  const sortedFailures = Object.entries(results.summary.byFailureType)
    .sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedFailures) {
    console.log(`  ${type.padEnd(30)} ${count}`);
  }

  // Failed vehicles detail
  const failedVehicles = results.vehicles.filter(v => !v.passed);
  if (failedVehicles.length > 0) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`FAILED VEHICLES (${failedVehicles.length}):`);
    console.log(`${"─".repeat(70)}\n`);
    
    for (const v of failedVehicles.slice(0, 20)) {
      console.log(`  ${v.year} ${v.make} ${v.model} (${v.trim})`);
      console.log(`    Category: ${v.category} | Confidence: ${v.confidenceTag}`);
      console.log(`    Failures: ${v.failures.join(", ")}`);
      console.log();
    }
    
    if (failedVehicles.length > 20) {
      console.log(`  ... and ${failedVehicles.length - 20} more (see full report)\n`);
    }
  }

  // Recommendations
  console.log(`${"─".repeat(70)}`);
  console.log(`RECOMMENDATIONS:`);
  console.log(`${"─".repeat(70)}\n`);

  if (results.summary.byFailureType["NO_BOLT_PATTERN"]) {
    console.log(`  ⚠️  ${results.summary.byFailureType["NO_BOLT_PATTERN"]} vehicles missing bolt pattern`);
    console.log(`     → Review LOW confidence records, consider platform templates\n`);
  }
  if (results.summary.byFailureType["STAGGERED_FLAG_MISSING"]) {
    console.log(`  ⚠️  ${results.summary.byFailureType["STAGGERED_FLAG_MISSING"]} staggered vehicles missing flag`);
    console.log(`     → Update staggered detection in wheel fitment search\n`);
  }
  if (results.summary.byFailureType["HD_MISSING_LT_SIZE"]) {
    console.log(`  ⚠️  ${results.summary.byFailureType["HD_MISSING_LT_SIZE"]} HD vehicles missing LT tire sizes`);
    console.log(`     → Review HD truck tire size data\n`);
  }
  if (results.summary.byFailureType["DEPRECATED_CONFIG_USAGE"]) {
    console.log(`  🚨 ${results.summary.byFailureType["DEPRECATED_CONFIG_USAGE"]} using deprecated config table!`);
    console.log(`     → Urgent: migrate to vehicle_fitments only\n`);
  }

  // Save report
  const reportPath = join(__dirname, `../../data/audit-reports/100-vehicle-audit-${new Date().toISOString().split("T")[0]}.json`);
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nFull report saved: ${reportPath}`);

  await client.end();
  
  // Exit with appropriate code
  const passRate = results.summary.passed / results.summary.total;
  process.exit(passRate >= 0.9 ? 0 : 1);
}

main().catch(console.error);
