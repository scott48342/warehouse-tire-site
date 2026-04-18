// Test WheelPros suspension/lift kit API
require('dotenv').config({ path: '.env.local' });

const WHEELPROS_USERNAME = process.env.WHEELPROS_PDP_USERNAME;
const WHEELPROS_PASSWORD = process.env.WHEELPROS_PDP_PASSWORD;

async function getToken() {
  const url = "https://api.wheelpros.com/auth/token";
  
  const res = await fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json" 
    },
    body: JSON.stringify({
      userName: WHEELPROS_USERNAME,
      password: WHEELPROS_PASSWORD,
    }),
  });
  
  if (!res.ok) {
    console.log("Auth failed:", res.status, await res.text());
    throw new Error("Auth failed");
  }
  
  const data = await res.json();
  return data.accessToken || data.token || data.access_token || data.tokenString;
}

async function searchSuspension(params = {}) {
  const token = await getToken();
  console.log("Token obtained (first 20 chars):", token?.slice(0, 20) + "...");
  
  const urlParams = new URLSearchParams({
    fields: "inventory,price",
    priceType: "msrp,map,nip",
    company: "1500",
    page: "1",
    pageSize: "20",
    ...params
  });
  
  const url = `https://api.wheelpros.com/products/v1/search/suspension?${urlParams}`;
  console.log("\nSuspension search URL:", url);
  
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  console.log("=== Testing WheelPros Lift Kit Lookup ===\n");
  console.log("Username:", WHEELPROS_USERNAME ? "configured (" + WHEELPROS_USERNAME.slice(0,4) + "...)" : "MISSING");
  console.log("Password:", WHEELPROS_PASSWORD ? "configured" : "MISSING");
  
  if (!WHEELPROS_USERNAME || !WHEELPROS_PASSWORD) {
    console.log("\nMissing WHEELPROS_PDP_USERNAME or WHEELPROS_PDP_PASSWORD in .env.local");
    return;
  }
  
  // Test 1: Search for specific part number
  console.log("\n=== Test 1: Part Number Search ===");
  await searchSuspension({ partNumber: "42-39640" });
  
  // Test 2: Search by keyword
  console.log("\n=== Test 2: Keyword Search (lift kit) ===");
  await searchSuspension({ keyword: "lift kit" });
  
  // Test 3: List all (to see structure)
  console.log("\n=== Test 3: List all suspension products ===");
  await searchSuspension({});
}

main().catch(console.error);
