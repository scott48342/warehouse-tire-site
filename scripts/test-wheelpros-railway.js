/**
 * Test WheelPros Railway Wrapper for Lift Kit / Suspension
 * Run: node scripts/test-wheelpros-railway.js
 */

const RAILWAY_BASE = "https://wheelpros-api-wrapper-production.up.railway.app";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function testEndpoint(path, params = {}) {
  const url = new URL(path, RAILWAY_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  console.log(`\n📡 Testing: ${url.pathname}${url.search}`);
  
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    
    console.log(`   Status: ${res.status}`);
    
    const text = await res.text();
    
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      console.log(`   ❌ Got HTML (likely error page)`);
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
  console.log("=".repeat(70));
  console.log("🔍 Testing WheelPros Railway Wrapper for Lift Kits / Suspension");
  console.log("   Wrapper: " + RAILWAY_BASE);
  console.log("=".repeat(70));

  // Test health / root
  console.log("\n📍 Testing wrapper endpoints...");
  
  const rootEndpoints = [
    "/",
    "/health",
    "/api",
    "/wheels/search",
    "/suspensions/search",
    "/suspension/search",
    "/accessories/search",
    "/parts/search",
  ];

  for (const path of rootEndpoints) {
    const data = await testEndpoint(path, { pageSize: "3" });
    if (data) {
      if (data.results) {
        console.log(`   ✅ ${data.results.length} results`);
        if (data.results.length > 0) {
          const s = data.results[0];
          console.log(`      Sample: ${s.sku || 'N/A'} - ${(s.title || s.description || 'N/A').slice(0, 50)}`);
        }
      } else if (data.error) {
        console.log(`   ❌ ${data.error}`);
      } else if (data.message) {
        console.log(`   Response: ${data.message}`);
      } else {
        console.log(`   ✅ Keys: ${Object.keys(data).join(", ")}`);
      }
    }
  }

  // Try with suspension brand codes
  console.log("\n" + "=".repeat(70));
  console.log("🔧 Testing with Suspension Brand Codes");
  console.log("=".repeat(70));

  const brandCodes = [
    { code: "BDS", name: "BDS Suspension" },
    { code: "FAB", name: "Fabtech" },
    { code: "PRO", name: "Pro Comp" },
    { code: "TEF", name: "Teraflex" },
    { code: "RCD", name: "Rough Country" },
    { code: "REA", name: "ReadyLIFT" },
    { code: "SKY", name: "Skyjacker" },
    { code: "ZON", name: "Zone Offroad" },
  ];

  for (const brand of brandCodes) {
    console.log(`\n📦 ${brand.name} (${brand.code})`);
    const data = await testEndpoint("/wheels/search", { 
      brand_cd: brand.code,
      pageSize: "5" 
    });
    
    if (data?.results) {
      console.log(`   Found ${data.results.length} results`);
      if (data.results.length > 0) {
        // Check if any are NOT wheels
        const nonWheels = data.results.filter(r => {
          const title = (r.title || "").toLowerCase();
          return title.includes("lift") || title.includes("suspension") || title.includes("leveling");
        });
        
        if (nonWheels.length > 0) {
          console.log(`   🎯 Found ${nonWheels.length} potential lift/suspension items!`);
          nonWheels.forEach(r => {
            console.log(`      - ${r.sku}: ${r.title}`);
          });
        }
        
        // Show first result regardless
        const s = data.results[0];
        console.log(`   First: ${s.sku} - ${(s.title || 'N/A').slice(0, 60)}`);
        console.log(`   Brand: ${JSON.stringify(s.brand)}`);
      }
    }
  }

  // Test YMM lookup
  console.log("\n" + "=".repeat(70));
  console.log("🚗 Testing YMM (2022 Ford F-150)");
  console.log("=".repeat(70));

  const ymmData = await testEndpoint("/wheels/search", {
    year: "2022",
    make: "Ford",
    model: "F-150",
    pageSize: "50"
  });

  if (ymmData?.results) {
    console.log(`\n📦 All results for 2022 F-150: ${ymmData.results.length} items`);
    
    // Group by brand
    const byBrand = {};
    ymmData.results.forEach(r => {
      const brandCode = r.brand?.code || r.brand?.description || "Unknown";
      byBrand[brandCode] = (byBrand[brandCode] || 0) + 1;
    });
    
    console.log("   By brand:", JSON.stringify(byBrand));
    
    // Check for any lift/suspension products
    const suspItems = ymmData.results.filter(r => {
      const title = (r.title || "").toLowerCase();
      return title.includes("lift") || title.includes("suspension") || title.includes("level");
    });
    
    if (suspItems.length > 0) {
      console.log(`\n   🎯 Found ${suspItems.length} lift/suspension items in results!`);
      suspItems.forEach(r => {
        console.log(`      - ${r.sku}: ${r.title}`);
      });
    } else {
      console.log("\n   ℹ️  No lift/suspension items in wheel search results");
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
