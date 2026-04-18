import { config } from 'dotenv';
config({ path: '.env.local' });

// Test WheelPros accessory API directly
async function getToken() {
  const res = await fetch("https://auth.wheelpros.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.WHEELPROS_CLIENT_ID,
      client_secret: process.env.WHEELPROS_CLIENT_SECRET,
      audience: process.env.WHEELPROS_AUDIENCE || "https://api.wheelpros.com",
    }),
  });
  
  if (!res.ok) {
    console.error("Token error:", res.status, await res.text());
    return null;
  }
  
  const data = await res.json();
  return data.access_token;
}

async function searchAccessories(token, filter) {
  const url = new URL("https://api.wheelpros.com/products/v1/search/accessory");
  url.searchParams.set("filter", filter);
  url.searchParams.set("fields", "inventory,price,media");
  url.searchParams.set("pageSize", "5");
  
  console.log(`\nSearching: ${filter}`);
  console.log(`URL: ${url.toString()}`);
  
  const res = await fetch(url.toString(), {
    headers: { 
      Accept: "application/json", 
      Authorization: `Bearer ${token}` 
    },
  });
  
  console.log(`Status: ${res.status}`);
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`Error: ${text.slice(0, 500)}`);
    return null;
  }
  
  const data = await res.json();
  console.log(`Results: ${data.total || 0} total, ${data.results?.length || 0} returned`);
  
  if (data.results?.[0]) {
    const first = data.results[0];
    console.log(`First result: ${first.sku} - ${first.title}`);
    console.log(`  Media: ${JSON.stringify(first.media || first.images || "none")}`);
  }
  
  return data;
}

const token = await getToken();
if (!token) {
  console.error("Failed to get token");
  process.exit(1);
}

console.log("Token obtained!");

await searchAccessories(token, "lug nut");
await searchAccessories(token, "hub ring");
await searchAccessories(token, "LED");
