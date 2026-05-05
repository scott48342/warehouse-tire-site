/**
 * Test WheelPros Order API - Create Order (EDI)
 * Based on official documentation from developer.wheelpros.com
 */

// Try both http and https
const AUTH_URL = "https://api.wheelpros.com/auth/v1/authorize";
const ORDER_URL_HTTPS = "https://api.wheelpros.com/orders/v1/create";
const ORDER_URL_HTTP = "http://api.wheelpros.com/orders/v1/create";

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
  return data.accessToken;
}

async function testCreateOrder(token, baseUrl) {
  console.log(`\n📦 Testing order creation at: ${baseUrl}`);
  
  const url = `${baseUrl}?orderType=edi`;
  
  // Test payload - minimal required fields only
  const payload = {
    purchaseOrderNumber: "TEST-DO-NOT-PROCESS-001",
    items: [
      {
        partNumber: "D75320907350", // Real Fuel wheel SKU
        quantity: 1,
        warehouseCode: 1001,
      }
    ],
    shipping: {
      shipToName: "TEST DO NOT SHIP",
      address1: "123 Test Street",
      city: "Testville",
      stateOrProvinceCode: "MI",
      postalCode: "48341",
      phone: "5555555555",
      email: "test@test.com",
      countryCode: "US",
    }
  };
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    
    const text = await res.text();
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log(`Response: ${text.slice(0, 1000)}`);
    
    return { status: res.status, body: text };
  } catch (err) {
    console.log(`Error: ${err.message}`);
    return { error: err.message };
  }
}

async function main() {
  const token = await getToken();
  console.log("✅ Got token:", token.slice(0, 50) + "...");
  
  // Test HTTPS first
  await testCreateOrder(token, ORDER_URL_HTTPS);
  
  // Test HTTP if HTTPS fails
  // await testCreateOrder(token, ORDER_URL_HTTP);
}

main().catch(console.error);
