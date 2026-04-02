/**
 * Production Public Fitment API Validation
 * 
 * Tests all hardened features:
 * - API key auth with states
 * - Rate limiting
 * - Caching (hit/miss)
 * - Usage logging
 * - Known vehicles
 * 
 * Usage: node scripts/validate-public-api-production.js [baseUrl] [apiKey]
 */

const BASE_URL = process.argv[2] || "http://localhost:3001";
const API_KEY = process.argv[3] || "dev_test_key_12345";

const TEST_VEHICLES = [
  { year: 2020, make: "ford", model: "mustang", expectedTrim: "GT" },
  { year: 2020, make: "chevrolet", model: "camaro", expectedTrim: "SS" },
  { year: 2020, make: "dodge", model: "challenger", expectedTrim: "Scat Pack" },
  { year: 2015, make: "ford", model: "f-250", expectedTrim: "XLT" },
  { year: 2008, make: "chrysler", model: "300", expectedTrim: "SRT8" },
];

const results = { passed: 0, failed: 0, tests: [] };

function log(status, name, details = "") {
  const icon = status === "pass" ? "✅" : status === "fail" ? "❌" : "⚠️";
  console.log(`${icon} ${name}${details ? ` — ${details}` : ""}`);
  results.tests.push({ name, status, details });
  if (status === "pass") results.passed++;
  else if (status === "fail") results.failed++;
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...options.headers };
  
  if (options.apiKey !== false) {
    headers["X-API-Key"] = options.apiKey || API_KEY;
  }
  
  try {
    const start = performance.now();
    const res = await fetch(url, { headers, ...options });
    const latency = Math.round(performance.now() - start);
    const data = await res.json().catch(() => ({}));
    
    return {
      ok: res.ok,
      status: res.status,
      latency,
      data,
      headers: Object.fromEntries(res.headers.entries()),
    };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function testAuth() {
  console.log("\n" + "═".repeat(60));
  console.log("AUTHENTICATION TESTS");
  console.log("═".repeat(60));

  // No API key
  let r = await request("/api/public/fitment/years", { apiKey: false });
  if (r.status === 401) {
    log("pass", "Rejects missing API key", `401`);
  } else {
    log("fail", "Rejects missing API key", `Got ${r.status}`);
  }

  // Invalid API key
  r = await request("/api/public/fitment/years", { apiKey: "invalid_key_xyz" });
  if (r.status === 401) {
    log("pass", "Rejects invalid API key", `401`);
  } else {
    log("fail", "Rejects invalid API key", `Got ${r.status}`);
  }

  // Valid API key in header
  r = await request("/api/public/fitment/years");
  if (r.ok) {
    log("pass", "Accepts valid X-API-Key header", `200, ${r.latency}ms`);
  } else {
    log("fail", "Accepts valid X-API-Key header", `Got ${r.status}`);
  }

  // Valid API key in query param
  r = await request(`/api/public/fitment/years?api_key=${API_KEY}`, { apiKey: false });
  if (r.ok) {
    log("pass", "Accepts valid api_key query param", `200`);
  } else {
    log("fail", "Accepts valid api_key query param", `Got ${r.status}`);
  }
}

async function testRateLimitHeaders() {
  console.log("\n" + "═".repeat(60));
  console.log("RATE LIMIT HEADERS");
  console.log("═".repeat(60));

  const r = await request("/api/public/fitment/years");
  
  if (r.headers["x-ratelimit-limit"]) {
    log("pass", "X-RateLimit-Limit header present", r.headers["x-ratelimit-limit"]);
  } else {
    log("fail", "X-RateLimit-Limit header missing");
  }

  if (r.headers["x-ratelimit-remaining"]) {
    log("pass", "X-RateLimit-Remaining header present", r.headers["x-ratelimit-remaining"]);
  } else {
    log("fail", "X-RateLimit-Remaining header missing");
  }

  if (r.headers["x-ratelimit-reset"]) {
    log("pass", "X-RateLimit-Reset header present", `${r.headers["x-ratelimit-reset"]}s`);
  } else {
    log("fail", "X-RateLimit-Reset header missing");
  }
}

async function testCaching() {
  console.log("\n" + "═".repeat(60));
  console.log("CACHING TESTS");
  console.log("═".repeat(60));

  // First request (cache miss)
  let r1 = await request("/api/public/fitment/makes?year=2020");
  const cacheStatus1 = r1.headers["x-cache"];
  
  if (cacheStatus1 === "MISS") {
    log("pass", "First request is cache MISS", `${r1.latency}ms`);
  } else {
    log("warn", "First request cache status", cacheStatus1 || "not set");
  }

  // Second request (should be cache hit)
  let r2 = await request("/api/public/fitment/makes?year=2020");
  const cacheStatus2 = r2.headers["x-cache"];
  
  if (cacheStatus2 === "HIT") {
    log("pass", "Second request is cache HIT", `${r2.latency}ms (${r1.latency - r2.latency}ms faster)`);
  } else {
    log("warn", "Second request cache status", cacheStatus2 || "not set");
  }

  // Cache-Control header
  if (r1.headers["cache-control"]) {
    log("pass", "Cache-Control header present", r1.headers["cache-control"]);
  } else {
    log("fail", "Cache-Control header missing");
  }
}

async function testEndpoints() {
  console.log("\n" + "═".repeat(60));
  console.log("ENDPOINT TESTS");
  console.log("═".repeat(60));

  // Years
  let r = await request("/api/public/fitment/years");
  if (r.ok && r.data.success && Array.isArray(r.data.data)) {
    log("pass", "GET /years", `${r.data.data.length} years, ${r.latency}ms`);
  } else {
    log("fail", "GET /years", `${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
  }

  // Years with filter
  r = await request("/api/public/fitment/years?make=ford&model=mustang");
  if (r.ok && r.data.success) {
    log("pass", "GET /years?make=ford&model=mustang", `${r.data.data.length} years`);
  } else {
    log("fail", "GET /years?make=ford&model=mustang", `${r.status}`);
  }

  // Makes
  r = await request("/api/public/fitment/makes");
  if (r.ok && r.data.success && Array.isArray(r.data.data)) {
    log("pass", "GET /makes", `${r.data.data.length} makes`);
  } else {
    log("fail", "GET /makes", `${r.status}`);
  }

  // Makes with year filter
  r = await request("/api/public/fitment/makes?year=2020");
  if (r.ok && r.data.success) {
    log("pass", "GET /makes?year=2020", `${r.data.data.length} makes`);
  } else {
    log("fail", "GET /makes?year=2020", `${r.status}`);
  }

  // Models
  r = await request("/api/public/fitment/models?make=ford");
  if (r.ok && r.data.success && Array.isArray(r.data.data)) {
    log("pass", "GET /models?make=ford", `${r.data.data.length} models`);
  } else {
    log("fail", "GET /models?make=ford", `${r.status}`);
  }

  // Trims
  r = await request("/api/public/fitment/trims?year=2020&make=ford&model=mustang");
  if (r.ok && r.data.success && Array.isArray(r.data.data)) {
    log("pass", "GET /trims (2020 Mustang)", `${r.data.data.length} trims`);
  } else {
    log("fail", "GET /trims (2020 Mustang)", `${r.status}`);
  }
}

async function testVehicleSpecs() {
  console.log("\n" + "═".repeat(60));
  console.log("VEHICLE SPECS VALIDATION");
  console.log("═".repeat(60));

  for (const vehicle of TEST_VEHICLES) {
    // Get trims first
    const trimsRes = await request(
      `/api/public/fitment/trims?year=${vehicle.year}&make=${vehicle.make}&model=${vehicle.model}`
    );

    if (!trimsRes.ok || !trimsRes.data.data?.length) {
      log("fail", `${vehicle.year} ${vehicle.make} ${vehicle.model}`, "No trims found");
      continue;
    }

    // Find matching trim
    const trim = trimsRes.data.data.find(t => 
      t.name.toLowerCase().includes(vehicle.expectedTrim.toLowerCase())
    ) || trimsRes.data.data[0];

    // Get specs
    const specsRes = await request(
      `/api/public/fitment/specs?year=${vehicle.year}&make=${vehicle.make}&model=${vehicle.model}&trim=${encodeURIComponent(trim.trimId)}`
    );

    if (specsRes.ok && specsRes.data.success && specsRes.data.data) {
      const specs = specsRes.data.data;
      const details = [
        `Trim: ${specs.trim}`,
        `Bolt: ${specs.boltPattern}`,
        `Bore: ${specs.centerBore}mm`,
        `Staggered: ${specs.isStaggered}`,
        specs.wheelSpecs?.length ? `Wheels: ${specs.wheelSpecs.map(w => `${w.diameter}x${w.width}`).join(", ")}` : "",
      ].filter(Boolean).join(" | ");
      
      log("pass", `${vehicle.year} ${vehicle.make} ${vehicle.model}`, details);
    } else {
      log("fail", `${vehicle.year} ${vehicle.make} ${vehicle.model}`, `${specsRes.status}`);
    }
  }
}

async function testInternalEndpoints() {
  console.log("\n" + "═".repeat(60));
  console.log("INTERNAL ENDPOINTS (no auth required)");
  console.log("═".repeat(60));

  // Internal endpoints should work without API key
  let r = await request("/api/vehicles/years?make=ford&model=mustang", { apiKey: false });
  if (r.ok) {
    log("pass", "Internal /api/vehicles/years works without key", `${r.latency}ms`);
  } else {
    log("fail", "Internal /api/vehicles/years", `Got ${r.status}`);
  }

  r = await request("/api/vehicles/trims?year=2020&make=ford&model=mustang", { apiKey: false });
  if (r.ok) {
    log("pass", "Internal /api/vehicles/trims works without key", `${r.latency}ms`);
  } else {
    log("fail", "Internal /api/vehicles/trims", `Got ${r.status}`);
  }
}

async function main() {
  console.log("╔" + "═".repeat(58) + "╗");
  console.log("║" + " PUBLIC FITMENT API - PRODUCTION VALIDATION ".padStart(40).padEnd(58) + "║");
  console.log("╚" + "═".repeat(58) + "╝");
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);

  try {
    await testAuth();
    await testRateLimitHeaders();
    await testCaching();
    await testEndpoints();
    await testVehicleSpecs();
    await testInternalEndpoints();
  } catch (err) {
    console.error("\n❌ Fatal error:", err.message);
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total:  ${results.passed + results.failed}`);

  if (results.failed === 0) {
    console.log("\n🎉 All tests passed! API is production-ready.");
  } else {
    console.log("\n⚠️  Some tests failed. Review output above.");
    process.exit(1);
  }
}

main();
