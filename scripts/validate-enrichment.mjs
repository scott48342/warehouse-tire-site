/**
 * Post-Enrichment Validation Script
 * Tests tire mileage + tread category enrichment
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Test cases
const TEST_SIZES = [
  "265/70R17",   // Popular truck size
  "225/45R18",   // Common sedan
  "245/75R16",   // Older truck
  "275/55R20",   // Large SUV
  "35X12.50R20", // Flotation
];

const TEST_VEHICLES = [
  { year: "2023", make: "Ford", model: "F-150", wheelDiameter: "17" },
  { year: "2024", make: "Toyota", model: "Camry", wheelDiameter: "18" },
  { year: "2022", make: "Jeep", model: "Wrangler", wheelDiameter: "17" },
];

async function fetchJson(url) {
  const start = Date.now();
  const res = await fetch(url);
  const elapsed = Date.now() - start;
  const data = await res.json();
  return { data, elapsed };
}

async function testSizeSearch(size) {
  const url = `${BASE_URL}/api/tires/search?size=${encodeURIComponent(size)}`;
  const { data, elapsed } = await fetchJson(url);
  
  return {
    size,
    elapsed,
    totalResults: data.results?.length || 0,
    sources: data.sources || {},
    circuitStatus: data.tirewebProtection?.circuit || "unknown",
    enrichmentStats: analyzeEnrichment(data.results || []),
  };
}

async function testVehicleSearch(vehicle) {
  const params = new URLSearchParams(vehicle);
  const url = `${BASE_URL}/api/tires/search?${params}`;
  const { data, elapsed } = await fetchJson(url);
  
  return {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    elapsed,
    totalResults: data.results?.length || 0,
    sources: data.sources || {},
    circuitStatus: data.tirewebProtection?.circuit || "unknown",
    enrichmentStats: analyzeEnrichment(data.results || []),
  };
}

async function testFilters(size) {
  const results = {};
  
  // Test mileage filter
  for (const band of ["40K+", "60K+", "80K+"]) {
    const url = `${BASE_URL}/api/tires/search?size=${encodeURIComponent(size)}&mileageBand=${encodeURIComponent(band)}`;
    const { data, elapsed } = await fetchJson(url);
    results[`mileage_${band}`] = {
      count: data.results?.length || 0,
      elapsed,
    };
  }
  
  // Test tread category filter
  for (const cat of ["All-Season", "All-Terrain", "Mud-Terrain", "Highway/Touring"]) {
    const url = `${BASE_URL}/api/tires/search?size=${encodeURIComponent(size)}&treadCategory=${encodeURIComponent(cat)}`;
    const { data, elapsed } = await fetchJson(url);
    results[`tread_${cat}`] = {
      count: data.results?.length || 0,
      elapsed,
    };
  }
  
  // Combined filter
  const combinedUrl = `${BASE_URL}/api/tires/search?size=${encodeURIComponent(size)}&mileageBand=60K%2B&treadCategory=All-Season`;
  const { data: combined, elapsed: combinedElapsed } = await fetchJson(combinedUrl);
  results.combined = {
    count: combined.results?.length || 0,
    elapsed: combinedElapsed,
  };
  
  return results;
}

function analyzeEnrichment(results) {
  const stats = {
    total: results.length,
    withMileage: 0,
    withTreadCategory: 0,
    withMileageBadge: 0,
    withLoadRange: 0,
    withRunFlat: 0,
    treadCategoryCounts: {},
    unmappedTerrains: {},
    mileageDistribution: { "0-40K": 0, "40K-60K": 0, "60K-80K": 0, "80K+": 0 },
  };
  
  for (const tire of results) {
    const e = tire.enrichment;
    const badges = tire.badges;
    
    if (e?.mileage || badges?.warrantyMiles) {
      stats.withMileage++;
      const m = e?.mileage || badges?.warrantyMiles;
      if (m >= 80000) stats.mileageDistribution["80K+"]++;
      else if (m >= 60000) stats.mileageDistribution["60K-80K"]++;
      else if (m >= 40000) stats.mileageDistribution["40K-60K"]++;
      else stats.mileageDistribution["0-40K"]++;
    }
    
    if (e?.treadCategory) {
      stats.withTreadCategory++;
      stats.treadCategoryCounts[e.treadCategory] = (stats.treadCategoryCounts[e.treadCategory] || 0) + 1;
    } else if (badges?.terrain) {
      // Track unmapped terrains
      const terrain = String(badges.terrain).trim();
      if (terrain) {
        stats.unmappedTerrains[terrain] = (stats.unmappedTerrains[terrain] || 0) + 1;
      }
    }
    
    if (e?.mileageBadge) stats.withMileageBadge++;
    if (e?.loadRange) stats.withLoadRange++;
    if (e?.isRunFlat) stats.withRunFlat++;
  }
  
  return stats;
}

function getSamplePayload(results, count = 2) {
  return results.slice(0, count).map(t => ({
    partNumber: t.partNumber,
    brand: t.brand,
    description: t.description?.slice(0, 50),
    source: t.source,
    badges: t.badges,
    enrichment: t.enrichment,
  }));
}

async function runValidation() {
  console.log("=".repeat(60));
  console.log("TIRE ENRICHMENT VALIDATION");
  console.log("=".repeat(60));
  console.log("");
  
  // 1. Test size searches
  console.log("1. SIZE SEARCH TESTS");
  console.log("-".repeat(40));
  
  const sizeResults = [];
  for (const size of TEST_SIZES) {
    const result = await testSizeSearch(size);
    sizeResults.push(result);
    console.log(`${size}: ${result.totalResults} results (${result.elapsed}ms)`);
    console.log(`  Sources: WP=${result.sources.wheelpros || 0}, TW=${result.sources.tireweb || 0}`);
    console.log(`  Circuit: ${result.circuitStatus}`);
    console.log(`  Enrichment: mileage=${result.enrichmentStats.withMileage}/${result.enrichmentStats.total}, tread=${result.enrichmentStats.withTreadCategory}/${result.enrichmentStats.total}`);
  }
  
  console.log("");
  
  // 2. Test vehicle searches
  console.log("2. VEHICLE SEARCH TESTS");
  console.log("-".repeat(40));
  
  for (const vehicle of TEST_VEHICLES) {
    const result = await testVehicleSearch(vehicle);
    console.log(`${result.vehicle}: ${result.totalResults} results (${result.elapsed}ms)`);
    console.log(`  Sources: WP=${result.sources.wheelpros || 0}, TW=${result.sources.tireweb || 0}`);
    console.log(`  Enrichment: mileage=${result.enrichmentStats.withMileage}/${result.enrichmentStats.total}`);
  }
  
  console.log("");
  
  // 3. Test filters
  console.log("3. FILTER TESTS (265/70R17)");
  console.log("-".repeat(40));
  
  const filterResults = await testFilters("265/70R17");
  for (const [filter, data] of Object.entries(filterResults)) {
    console.log(`  ${filter}: ${data.count} results (${data.elapsed}ms)`);
  }
  
  console.log("");
  
  // 4. Coverage analysis
  console.log("4. COVERAGE BY SUPPLIER");
  console.log("-".repeat(40));
  
  // Aggregate from size results
  let totalWP = 0, totalTW = 0;
  let wpWithMileage = 0, wpWithTread = 0;
  let twWithMileage = 0, twWithTread = 0;
  
  // Get detailed breakdown from one search
  const detailUrl = `${BASE_URL}/api/tires/search?size=265/70R17`;
  const { data: detailData } = await fetchJson(detailUrl);
  
  for (const tire of (detailData.results || [])) {
    const isWP = tire.source === "wheelpros";
    const isTW = tire.source?.startsWith("tireweb");
    
    if (isWP) {
      totalWP++;
      if (tire.enrichment?.mileage || tire.badges?.warrantyMiles) wpWithMileage++;
      if (tire.enrichment?.treadCategory) wpWithTread++;
    }
    if (isTW) {
      totalTW++;
      if (tire.enrichment?.mileage || tire.badges?.warrantyMiles) twWithMileage++;
      if (tire.enrichment?.treadCategory) twWithTread++;
    }
  }
  
  console.log(`  WheelPros: ${totalWP} total, ${wpWithMileage} with mileage (${Math.round(wpWithMileage/totalWP*100)||0}%), ${wpWithTread} with tread (${Math.round(wpWithTread/totalWP*100)||0}%)`);
  console.log(`  TireWeb:   ${totalTW} total, ${twWithMileage} with mileage (${Math.round(twWithMileage/totalTW*100)||0}%), ${twWithTread} with tread (${Math.round(twWithTread/totalTW*100)||0}%)`);
  
  console.log("");
  
  // 5. Unmapped terrains
  console.log("5. TOP UNMAPPED TERRAIN LABELS");
  console.log("-".repeat(40));
  
  const allUnmapped = {};
  for (const result of sizeResults) {
    for (const [terrain, count] of Object.entries(result.enrichmentStats.unmappedTerrains)) {
      allUnmapped[terrain] = (allUnmapped[terrain] || 0) + count;
    }
  }
  
  const sortedUnmapped = Object.entries(allUnmapped).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (sortedUnmapped.length === 0) {
    console.log("  (none - all terrains mapped!)");
  } else {
    for (const [terrain, count] of sortedUnmapped) {
      console.log(`  "${terrain}": ${count}`);
    }
  }
  
  console.log("");
  
  // 6. Tread category distribution
  console.log("6. TREAD CATEGORY DISTRIBUTION");
  console.log("-".repeat(40));
  
  const allTreadCounts = {};
  for (const result of sizeResults) {
    for (const [cat, count] of Object.entries(result.enrichmentStats.treadCategoryCounts)) {
      allTreadCounts[cat] = (allTreadCounts[cat] || 0) + count;
    }
  }
  
  const sortedTread = Object.entries(allTreadCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedTread) {
    console.log(`  ${cat}: ${count}`);
  }
  
  console.log("");
  
  // 7. Sample payloads
  console.log("7. SAMPLE PAYLOAD (before/after enrichment)");
  console.log("-".repeat(40));
  
  const samples = getSamplePayload(detailData.results || [], 3);
  console.log(JSON.stringify(samples, null, 2));
  
  console.log("");
  
  // 8. Performance summary
  console.log("8. PERFORMANCE SUMMARY");
  console.log("-".repeat(40));
  
  const avgSize = sizeResults.reduce((s, r) => s + r.elapsed, 0) / sizeResults.length;
  const avgFilter = Object.values(filterResults).reduce((s, r) => s + r.elapsed, 0) / Object.keys(filterResults).length;
  
  console.log(`  Avg size search: ${Math.round(avgSize)}ms`);
  console.log(`  Avg filter search: ${Math.round(avgFilter)}ms`);
  console.log(`  Circuit breaker: ${sizeResults[0]?.circuitStatus || "unknown"}`);
  
  console.log("");
  console.log("=".repeat(60));
  console.log("VALIDATION COMPLETE");
  console.log("=".repeat(60));
}

runValidation().catch(console.error);
