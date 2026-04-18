import { config } from 'dotenv';
config({ path: '.env.local' });

const skus = ["K4CS-00012BGR", "106-8410", "21631BC", "LF351"];

// Check env vars
console.log("Checking env vars...");
console.log("WHEELPROS_CLIENT_ID:", process.env.WHEELPROS_CLIENT_ID ? "✓ set" : "✗ missing");
console.log("WHEELPROS_CLIENT_SECRET:", process.env.WHEELPROS_CLIENT_SECRET ? "✓ set" : "✗ missing");

// Get token
async function getToken() {
  console.log("\nGetting WheelPros token...");
  
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
    const text = await res.text();
    console.error("Token error:", res.status, text);
    return null;
  }
  
  const data = await res.json();
  console.log("Token obtained! ✓");
  return data.access_token;
}

async function lookupSku(token, sku) {
  console.log(`\n=== Looking up SKU: ${sku} ===`);
  
  // Try accessory search with filter
  const url = new URL("https://api.wheelpros.com/products/v1/search/accessory");
  url.searchParams.set("filter", sku);
  url.searchParams.set("fields", "inventory,price,media");
  url.searchParams.set("priceType", "msrp,map,nip");
  url.searchParams.set("pageSize", "5");
  
  const res = await fetch(url.toString(), {
    headers: { 
      Accept: "application/json", 
      Authorization: `Bearer ${token}` 
    },
  });
  
  console.log(`Status: ${res.status}`);
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`Error: ${text.slice(0, 300)}`);
    return;
  }
  
  const data = await res.json();
  console.log(`Total results: ${data.total || 0}`);
  
  if (data.results?.length) {
    const item = data.results[0];
    console.log(`\nFirst result:`);
    console.log(`  SKU: ${item.sku}`);
    console.log(`  Title: ${item.title}`);
    console.log(`  Brand: ${item.brand?.description || item.brand?.code || "N/A"}`);
    console.log(`  MSRP: ${item.prices?.msrp?.[0]?.currencyAmount || "N/A"}`);
    console.log(`  MAP: ${item.prices?.map?.[0]?.currencyAmount || "N/A"}`);
    console.log(`  NIP: ${item.prices?.nip?.[0]?.currencyAmount || "N/A"}`);
    console.log(`  Media: ${JSON.stringify(item.media || item.images || "none")}`);
    console.log(`  Inventory: ${JSON.stringify(item.inventory || "none")}`);
  } else {
    console.log("No results found");
  }
}

try {
  const token = await getToken();
  if (!token) {
    console.error("Failed to get token, exiting");
    process.exit(1);
  }

  for (const sku of skus) {
    await lookupSku(token, sku);
  }
} catch (err) {
  console.error("Error:", err.message);
  console.error("Stack:", err.stack);
}
