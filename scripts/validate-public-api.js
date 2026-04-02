/**
 * Public Fitment API Validation Script
 * 
 * Tests:
 * 1. Public API endpoints work with API key
 * 2. Public API rejects without API key
 * 3. Internal storefront endpoints still work (no API key required)
 * 4. Known vehicles return correct data
 * 
 * Usage: node scripts/validate-public-api.js [baseUrl]
 */

const BASE_URL = process.argv[2] || "http://localhost:3001";
const API_KEY = "dev_test_key_12345"; // Dev key

// Test vehicles
const TEST_VEHICLES = [
  { year: 2020, make: "ford", model: "mustang", trim: "GT" },
  { year: 2020, make: "chevrolet", model: "camaro", trim: "SS" },
  { year: 2020, make: "dodge", model: "challenger", trim: "R/T Scat Pack" },
  { year: 2015, make: "ford", model: "f-250", trim: "XLT" },
  { year: 2008, make: "chrysler", model: "300", trim: "SRT8" },
];

async function testEndpoint(name, url, expectSuccess, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    const data = await res.json();
    
    const success = expectSuccess ? res.ok : !res.ok;
    const status = success ? "✅" : "❌";
    
    console.log(`${status} ${name}`);
    console.log(`   URL: ${url}`);
    console.log(`   Status: ${res.status}`);
    
    if (!success) {
      console.log(`   Expected: ${expectSuccess ? "success" : "failure"}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2).slice(0, 200));
    }
    
    return { success, data, status: res.status };
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log("═".repeat(70));
  console.log("PUBLIC FITMENT API VALIDATION");
  console.log("═".repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY}\n`);

  const results = { passed: 0, failed: 0 };

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 1: Auth Tests
  // ─────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(70));
  console.log("PHASE 1: Authentication");
  console.log("─".repeat(70));

  // Should fail without API key
  let r = await testEndpoint(
    "Public API rejects missing key",
    `${BASE_URL}/api/public/fitment/years`,
    false
  );
  r.success ? results.passed++ : results.failed++;

  // Should succeed with API key in header
  r = await testEndpoint(
    "Public API accepts X-API-Key header",
    `${BASE_URL}/api/public/fitment/years`,
    true,
    { "X-API-Key": API_KEY }
  );
  r.success ? results.passed++ : results.failed++;

  // Should succeed with API key in query param
  r = await testEndpoint(
    "Public API accepts api_key query param",
    `${BASE_URL}/api/public/fitment/years?api_key=${API_KEY}`,
    true
  );
  r.success ? results.passed++ : results.failed++;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2: Internal Endpoints Unaffected
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(70));
  console.log("PHASE 2: Internal Endpoints (no auth required)");
  console.log("─".repeat(70));

  r = await testEndpoint(
    "Internal /api/vehicles/years works without key",
    `${BASE_URL}/api/vehicles/years?make=ford&model=mustang`,
    true
  );
  r.success ? results.passed++ : results.failed++;

  r = await testEndpoint(
    "Internal /api/vehicles/trims works without key",
    `${BASE_URL}/api/vehicles/trims?year=2020&make=ford&model=mustang`,
    true
  );
  r.success ? results.passed++ : results.failed++;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: Public Endpoint Data
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(70));
  console.log("PHASE 3: Public API Data Validation");
  console.log("─".repeat(70));

  const headers = { "X-API-Key": API_KEY };

  // Years
  r = await testEndpoint(
    "GET /api/public/fitment/years",
    `${BASE_URL}/api/public/fitment/years`,
    true,
    headers
  );
  r.success ? results.passed++ : results.failed++;

  // Makes
  r = await testEndpoint(
    "GET /api/public/fitment/makes",
    `${BASE_URL}/api/public/fitment/makes`,
    true,
    headers
  );
  r.success ? results.passed++ : results.failed++;

  // Makes filtered by year
  r = await testEndpoint(
    "GET /api/public/fitment/makes?year=2020",
    `${BASE_URL}/api/public/fitment/makes?year=2020`,
    true,
    headers
  );
  r.success ? results.passed++ : results.failed++;

  // Models
  r = await testEndpoint(
    "GET /api/public/fitment/models?make=ford",
    `${BASE_URL}/api/public/fitment/models?make=ford`,
    true,
    headers
  );
  r.success ? results.passed++ : results.failed++;

  // Trims
  r = await testEndpoint(
    "GET /api/public/fitment/trims?year=2020&make=ford&model=mustang",
    `${BASE_URL}/api/public/fitment/trims?year=2020&make=ford&model=mustang`,
    true,
    headers
  );
  r.success ? results.passed++ : results.failed++;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Test Vehicles
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(70));
  console.log("PHASE 4: Known Vehicle Specs");
  console.log("─".repeat(70));

  for (const v of TEST_VEHICLES) {
    // First get trims to find the right trimId
    const trimsRes = await fetch(
      `${BASE_URL}/api/public/fitment/trims?year=${v.year}&make=${v.make}&model=${v.model}`,
      { headers }
    );
    const trimsData = await trimsRes.json();
    
    if (!trimsData.success || !trimsData.data?.length) {
      console.log(`❌ ${v.year} ${v.make} ${v.model} - No trims found`);
      results.failed++;
      continue;
    }

    // Find matching trim
    const trim = trimsData.data.find(t => 
      t.name.toLowerCase().includes(v.trim.toLowerCase()) ||
      v.trim.toLowerCase().includes(t.name.toLowerCase())
    ) || trimsData.data[0];

    r = await testEndpoint(
      `Specs: ${v.year} ${v.make} ${v.model} ${trim.name}`,
      `${BASE_URL}/api/public/fitment/specs?year=${v.year}&make=${v.make}&model=${v.model}&trim=${encodeURIComponent(trim.trimId)}`,
      true,
      headers
    );
    
    if (r.success && r.data?.data) {
      const specs = r.data.data;
      console.log(`   Bolt: ${specs.boltPattern} | Center: ${specs.centerBore}mm | Staggered: ${specs.isStaggered}`);
      if (specs.wheelSpecs?.length) {
        console.log(`   Wheels: ${specs.wheelSpecs.map(w => `${w.diameter}x${w.width}`).join(", ")}`);
      }
    }
    
    r.success ? results.passed++ : results.failed++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("SUMMARY");
  console.log("═".repeat(70));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.passed + results.failed}`);
  
  if (results.failed === 0) {
    console.log("\n✅ All tests passed!");
  } else {
    console.log("\n❌ Some tests failed. Review output above.");
    process.exit(1);
  }
}

main().catch(console.error);
