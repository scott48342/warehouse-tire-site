/**
 * Test WheelPros Order API
 * 
 * Probes available Order API endpoints to understand the structure
 */

const AUTH_URL = "https://api.wheelpros.com/auth/v1/authorize";
const ORDER_API_BASE = "https://api.wheelpros.com/orders/v1";

const USERNAME = process.env.WHEELPROS_USERNAME || "scott@warehousetire.net";
const PASSWORD = process.env.WHEELPROS_PASSWORD || "Websters1!";

async function getToken() {
  console.log("🔐 Authenticating with WheelPros...");
  
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
  });
  
  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  const token = data.accessToken || data.token || data.access_token;
  
  if (!token) {
    console.error("Auth response:", data);
    throw new Error("No token in auth response");
  }
  
  console.log("✅ Got auth token");
  return token;
}

async function probeEndpoint(token, path, method = "GET") {
  const url = `${ORDER_API_BASE}${path}`;
  console.log(`\n📡 ${method} ${url}`);
  
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    console.log(`   Status: ${res.status} ${res.statusText}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2).slice(0, 1000));
    
    return { status: res.status, data };
  } catch (err) {
    console.log(`   Error: ${err.message}`);
    return { error: err.message };
  }
}

async function main() {
  try {
    const token = await getToken();
    
    // Probe various possible endpoints
    const endpoints = [
      "/",
      "/orders",
      "/order",
      "/create",
      "/submit",
      "/status",
      "/swagger",
      "/docs",
      "/openapi.json",
      "/health",
    ];
    
    for (const ep of endpoints) {
      await probeEndpoint(token, ep);
    }
    
    // Try OPTIONS to see what methods are allowed
    console.log("\n\n📋 Checking OPTIONS on /orders...");
    const optRes = await fetch(`${ORDER_API_BASE}/orders`, {
      method: "OPTIONS",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    console.log("Allow header:", optRes.headers.get("allow"));
    console.log("Access-Control-Allow-Methods:", optRes.headers.get("access-control-allow-methods"));
    
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

main();
