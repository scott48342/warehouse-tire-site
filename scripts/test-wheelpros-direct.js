/**
 * Test WheelPros API DIRECTLY for Lift Kit / Suspension
 * Requires WHEELPROS_USERNAME and WHEELPROS_PASSWORD in .env.local
 * Run: node scripts/test-wheelpros-direct.js
 */

require('dotenv').config({ path: '.env.local' });

const AUTH_BASE_URL = "https://api.wheelpros.com/auth";
const PRODUCTS_BASE_URL = "https://api.wheelpros.com/products";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// Try to get credentials from various env vars
const USERNAME = process.env.WHEELPROS_USERNAME || process.env.WP_USERNAME || "";
const PASSWORD = process.env.WHEELPROS_PASSWORD || process.env.WP_PASSWORD || "";

async function getToken() {
  console.log("🔐 Getting WheelPros token...");
  console.log(`   Auth URL: ${AUTH_BASE_URL}/v1/authorize`);
  console.log(`   Username: ${USERNAME ? USERNAME.slice(0,3) + "***" : "(missing)"}`);
  console.log(`   Password: ${PASSWORD ? "***" : "(missing)"}`);
  
  if (!USERNAME || !PASSWORD) {
    throw new Error("Missing WHEELPROS_USERNAME or WHEELPROS_PASSWORD");
  }
  
  const res = await fetch(`${AUTH_BASE_URL}/v1/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
  });

  console.log(`   Auth response: ${res.status}`);
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed: ${res.status} - ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  console.log("✅ Token acquired");
  return data.accessToken;
}

async function testEndpoint(token, path, params = {}) {
  const url = new URL(path, PRODUCTS_BASE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  console.log(`\n📡 Testing: ${url.pathname}${url.search}`);
  
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
        "Authorization": `Bearer ${token}`,
      },
    });
    
    console.log(`   Status: ${res.status}`);
    
    if (!res.ok) {
      const text = await res.text();
      console.log(`   Error: ${text.slice(0, 300)}`);
      return { error: res.status, message: text.slice(0, 200) };
    }
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { error: err.message };
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("🔍 Testing WheelPros DIRECT API for Lift Kits / Suspension");
  console.log("=".repeat(70));

  let token;
  try {
    token = await getToken();
  } catch (err) {
    console.log(`\n❌ Cannot authenticate: ${err.message}`);
    console.log("\nTo test, add to .env.local:");
    console.log("  WHEELPROS_USERNAME=your_username");
    console.log("  WHEELPROS_PASSWORD=your_password");
    console.log("\nAlternatively, check Vercel env vars for the production credentials.");
    process.exit(1);
  }

  // Test product types / categories
  console.log("\n" + "=".repeat(70));
  console.log("📋 Discovering API structure");
  console.log("=".repeat(70));

  const discoveryEndpoints = [
    { path: "/v1/", name: "API Root" },
    { path: "/v1/categories", name: "Categories" },
    { path: "/v1/product-types", name: "Product Types" },
    { path: "/v1/brands", name: "Brands" },
  ];

  for (const ep of discoveryEndpoints) {
    const data = await testEndpoint(token, ep.path);
    if (data && !data.error) {
      console.log(`   ✅ ${ep.name}:`, Array.isArray(data) ? `${data.length} items` : Object.keys(data).join(", "));
      if (Array.isArray(data) && data.length > 0 && data.length < 30) {
        console.log(`   Items: ${data.slice(0, 15).map(d => typeof d === 'string' ? d : (d.code || d.name || d.description || JSON.stringify(d).slice(0, 30))).join(", ")}`);
      }
    }
  }

  // Test various search endpoints for suspensions
  console.log("\n" + "=".repeat(70));
  console.log("🔧 Testing Suspension / Lift Kit Search Endpoints");
  console.log("=".repeat(70));

  const searchEndpoints = [
    // Wheels (known working)
    { path: "/v1/search/wheel", params: { pageSize: "3" }, name: "Wheel Search (baseline)" },
    
    // Potential suspension endpoints
    { path: "/v1/search/suspension", params: { pageSize: "3" }, name: "Suspension Search" },
    { path: "/v1/search/lift", params: { pageSize: "3" }, name: "Lift Search" },
    { path: "/v1/search/accessory", params: { pageSize: "3" }, name: "Accessory Search" },
    { path: "/v1/search/accessories", params: { pageSize: "3" }, name: "Accessories Search" },
    { path: "/v1/search/part", params: { pageSize: "3" }, name: "Part Search" },
    { path: "/v1/search/parts", params: { pageSize: "3" }, name: "Parts Search" },
    { path: "/v1/search/product", params: { pageSize: "3" }, name: "Product Search" },
    
    // Try with product type parameter
    { path: "/v1/search/wheel", params: { pageSize: "3", productType: "suspension" }, name: "Wheel + productType=suspension" },
    { path: "/v1/search/wheel", params: { pageSize: "3", category: "suspension" }, name: "Wheel + category=suspension" },
  ];

  for (const ep of searchEndpoints) {
    const data = await testEndpoint(token, ep.path, ep.params);
    if (data) {
      if (data.results) {
        console.log(`   ✅ ${data.results.length} results`);
        if (data.results.length > 0) {
          const s = data.results[0];
          console.log(`      Sample: ${s.sku || 'N/A'} - ${(s.title || s.description || 'N/A').slice(0, 50)}`);
        }
      } else if (data.error) {
        console.log(`   ❌ ${data.error}`);
      } else {
        console.log(`   Keys: ${Object.keys(data).join(", ")}`);
      }
    }
  }

  // Test YMM-based lookup for suspension
  console.log("\n" + "=".repeat(70));
  console.log("🚗 Testing YMM Fitment Endpoints (2022 Ford F-150)");
  console.log("=".repeat(70));

  const ymmEndpoints = [
    { path: "/v1/fitment/wheel", params: { year: "2022", make: "Ford", model: "F-150" }, name: "Wheel Fitment" },
    { path: "/v1/fitment/suspension", params: { year: "2022", make: "Ford", model: "F-150" }, name: "Suspension Fitment" },
    { path: "/v1/fitment/lift", params: { year: "2022", make: "Ford", model: "F-150" }, name: "Lift Fitment" },
    { path: "/v1/vehicles/2022/Ford/F-150/suspensions", params: {}, name: "Vehicle Suspensions" },
    { path: "/v1/vehicles/2022/Ford/F-150/accessories", params: {}, name: "Vehicle Accessories" },
  ];

  for (const ep of ymmEndpoints) {
    const data = await testEndpoint(token, ep.path, ep.params);
    if (data) {
      if (data.results) {
        console.log(`   ✅ ${data.results.length} results`);
        if (data.results.length > 0) {
          data.results.slice(0, 2).forEach((r, i) => {
            console.log(`      [${i+1}] ${r.sku || r.partNumber || 'N/A'} - ${(r.title || r.description || r.name || 'N/A').slice(0, 50)}`);
          });
        }
      } else if (Array.isArray(data)) {
        console.log(`   ✅ Array: ${data.length} items`);
      } else if (data.error) {
        console.log(`   ❌ ${typeof data.error === 'string' ? data.error.slice(0, 100) : data.error}`);
      } else {
        console.log(`   Response keys: ${Object.keys(data).join(", ")}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ Test complete");
  console.log("=".repeat(70));
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
