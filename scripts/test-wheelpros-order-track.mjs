/**
 * Test WheelPros Order API - Track Order
 */

const AUTH_URL = "https://api.wheelpros.com/auth/v1/authorize";
const TRACK_URL = "https://api.wheelpros.com/orders/v1/track";

const USERNAME = process.env.WHEELPROS_USERNAME || "scott@warehousetire.net";
const PASSWORD = process.env.WHEELPROS_PASSWORD || "Websters1!";

async function getToken() {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
  });
  const data = await res.json();
  return data.accessToken;
}

async function main() {
  const token = await getToken();
  console.log("✅ Got token");
  
  // Try tracking with a PO number
  const url = `${TRACK_URL}?poNumber=TEST-001`;
  
  console.log(`\n📦 Testing tracking: ${url}`);
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });
  
  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log(`Response: ${text}`);
}

main().catch(console.error);
