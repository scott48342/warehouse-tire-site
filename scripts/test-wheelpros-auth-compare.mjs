/**
 * Compare WheelPros Product API vs Order API auth
 */

const AUTH_URL = "https://api.wheelpros.com/auth/v1/authorize";
const PRODUCT_API = "https://api.wheelpros.com/product/v1";
const ORDER_API = "https://api.wheelpros.com/orders/v1";

const USERNAME = process.env.WHEELPROS_USERNAME || "scott@warehousetire.net";
const PASSWORD = process.env.WHEELPROS_PASSWORD || "Websters1!";

async function getToken() {
  console.log("🔐 Getting auth token...");
  
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
  });
  
  const data = await res.json();
  console.log("Auth response keys:", Object.keys(data));
  console.log("Full auth response:", JSON.stringify(data, null, 2));
  
  return data;
}

async function testProductAPI(token) {
  console.log("\n\n📦 Testing PRODUCT API with Bearer token...");
  const url = `${PRODUCT_API}/wheel/search?diameter=20&pageSize=1`;
  
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });
  
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    const data = await res.json();
    console.log("✅ Product API works! Got", data.totalElements, "results");
  } else {
    const text = await res.text();
    console.log("❌ Product API failed:", text.slice(0, 500));
  }
}

async function testOrderAPIVariations(authData) {
  const token = authData.accessToken || authData.token;
  
  console.log("\n\n📋 Testing ORDER API with various auth approaches...");
  
  // Try 1: Bearer token (same as product)
  console.log("\n1️⃣ Bearer token:");
  let res = await fetch(`${ORDER_API}/`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });
  console.log(`   Status: ${res.status} - ${(await res.text()).slice(0, 200)}`);
  
  // Try 2: Token directly
  console.log("\n2️⃣ Token header:");
  res = await fetch(`${ORDER_API}/`, {
    headers: {
      "Token": token,
      "Accept": "application/json",
    },
  });
  console.log(`   Status: ${res.status} - ${(await res.text()).slice(0, 200)}`);
  
  // Try 3: X-API-Key
  console.log("\n3️⃣ X-API-Key header:");
  res = await fetch(`${ORDER_API}/`, {
    headers: {
      "X-API-Key": token,
      "Accept": "application/json",
    },
  });
  console.log(`   Status: ${res.status} - ${(await res.text()).slice(0, 200)}`);
  
  // Try 4: Basic auth with username:password
  console.log("\n4️⃣ Basic auth:");
  const basicAuth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
  res = await fetch(`${ORDER_API}/`, {
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Accept": "application/json",
    },
  });
  console.log(`   Status: ${res.status} - ${(await res.text()).slice(0, 200)}`);
  
  // Try 5: No auth (just to see the difference)
  console.log("\n5️⃣ No auth:");
  res = await fetch(`${ORDER_API}/`, {
    headers: {
      "Accept": "application/json",
    },
  });
  console.log(`   Status: ${res.status} - ${(await res.text()).slice(0, 200)}`);
}

async function main() {
  const authData = await getToken();
  const token = authData.accessToken || authData.token;
  
  await testProductAPI(token);
  await testOrderAPIVariations(authData);
}

main().catch(console.error);
