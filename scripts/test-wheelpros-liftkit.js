/**
 * Test WheelPros API for Lift Kit / Suspension availability
 * Uses the production proxy which handles auth
 * Run: node scripts/test-wheelpros-liftkit.js
 */

const PROXY_BASE = "https://shop.warehousetiredirect.com/api/wheelpros-proxy";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function testEndpoint(path, params = {}) {
  const url = new URL(PROXY_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  console.log(`\n📡 Testing: ${url.toString()}`);
  
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    
    console.log(`   Status: ${res.status}`);
    
    const text = await res.text();
    
    // Check if it's HTML (error page) vs JSON
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      console.log(`   ❌ Got HTML response (likely 404)`);
      return null;
    }
    
    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      console.log(`   ❌ Invalid JSON: ${text.slice(0, 200)}`);
      return null;
    }
  } catch (err) {
    console.log(`   ❌ Fetch error: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🔍 Testing WheelPros API for Lift Kits / Suspension");
  console.log("=".repeat(60));

  // First, check health
  console.log("\n📍 Checking proxy health...");
  const health = await testEndpoint("/health");
  if (health) {
    console.log("   ✅ Health:", JSON.stringify(health));
  }

  // Test wheel search endpoint to confirm it works
  console.log("\n📍 Testing wheel search (baseline)...");
  const wheelTest = await testEndpoint("/wheels/search", { 
    pageSize: "2",
    brand_cd: "ATX" 
  });
  if (wheelTest?.results) {
    console.log(`   ✅ Wheel search works! Found ${wheelTest.results.length} results`);
    if (wheelTest.results[0]) {
      console.log(`   Sample: ${wheelTest.results[0].sku} - ${wheelTest.results[0].title?.slice(0, 50)}`);
    }
  }

  // Try various suspension/lift kit endpoints through the proxy
  console.log("\n" + "=".repeat(60));
  console.log("🔧 Testing potential suspension/lift kit endpoints");
  console.log("=".repeat(60));

  const endpoints = [
    // Try different product type search paths
    { path: "/suspensions/search", params: { pageSize: "5" }, name: "Suspensions Search" },
    { path: "/suspension/search", params: { pageSize: "5" }, name: "Suspension Search" },
    { path: "/accessories/search", params: { pageSize: "5" }, name: "Accessories Search" },
    
    // Try wheel search with suspension-related queries
    { path: "/wheels/search", params: { pageSize: "10", q: "lift" }, name: "Wheel Search: 'lift'" },
    { path: "/wheels/search", params: { pageSize: "10", q: "suspension" }, name: "Wheel Search: 'suspension'" },
    { path: "/wheels/search", params: { pageSize: "10", q: "leveling kit" }, name: "Wheel Search: 'leveling kit'" },
    
    // BDS Suspension is a WheelPros brand for lift kits
    { path: "/wheels/search", params: { pageSize: "10", brand_cd: "BDS" }, name: "Brand: BDS Suspension" },
    { path: "/wheels/search", params: { pageSize: "10", brand_cd: "PRO" }, name: "Brand: Pro Comp" },
    { path: "/wheels/search", params: { pageSize: "10", brand_cd: "FAB" }, name: "Brand: Fabtech" },
  ];

  for (const ep of endpoints) {
    console.log(`\n📦 ${ep.name}`);
    const data = await testEndpoint(ep.path, ep.params);
    
    if (data) {
      if (data.results) {
        console.log(`   ✅ Found ${data.results.length} results`);
        if (data.results.length > 0) {
          const sample = data.results[0];
          console.log(`   Sample SKU: ${sample.sku || 'N/A'}`);
          console.log(`   Sample Title: ${sample.title || 'N/A'}`);
          console.log(`   Sample Brand: ${JSON.stringify(sample.brand) || 'N/A'}`);
          if (sample.properties) {
            console.log(`   Properties: ${JSON.stringify(sample.properties).slice(0, 200)}`);
          }
        }
      } else if (data.error) {
        console.log(`   ❌ Error: ${data.error}`);
      } else {
        console.log(`   Response keys: ${Object.keys(data).join(", ")}`);
      }
    }
  }

  // Test YMM-based search for suspension
  console.log("\n" + "=".repeat(60));
  console.log("🚗 Testing YMM-based queries (2022 Ford F-150)");
  console.log("=".repeat(60));

  const ymmParams = {
    year: "2022",
    make: "Ford", 
    model: "F-150",
    pageSize: "20"
  };

  const ymmEndpoints = [
    { path: "/wheels/search", params: { ...ymmParams, q: "lift" }, name: "YMM + 'lift' keyword" },
    { path: "/wheels/search", params: { ...ymmParams, brand_cd: "BDS" }, name: "YMM + BDS brand" },
    { path: "/wheels/search", params: { ...ymmParams, q: "suspension" }, name: "YMM + 'suspension'" },
  ];

  for (const ep of ymmEndpoints) {
    console.log(`\n📦 ${ep.name}`);
    const data = await testEndpoint(ep.path, ep.params);
    
    if (data?.results) {
      console.log(`   ✅ Found ${data.results.length} results`);
      if (data.results.length > 0) {
        data.results.slice(0, 5).forEach((r, i) => {
          console.log(`   [${i+1}] ${r.sku} - ${r.title?.slice(0, 60) || 'N/A'}`);
        });
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test complete");
  console.log("=".repeat(60));
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
