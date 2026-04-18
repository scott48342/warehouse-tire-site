import { config } from 'dotenv';
config({ path: '.env.local' });

// Manually get token and test search
const tokenRes = await fetch("https://auth.wheelpros.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.WHEELPROS_CLIENT_ID,
    client_secret: process.env.WHEELPROS_CLIENT_SECRET,
    audience: process.env.WHEELPROS_AUDIENCE || "https://api.wheelpros.com",
  }),
});

const tokenData = await tokenRes.json();
const token = tokenData.access_token;

// Test different accessory searches
const categories = [
  "hub ring",
  "hub centric", 
  "LED",
  "light bar",
  "TPMS",
  "valve stem",
  "center cap",
  "wheel lock",
  "spacer",
];

for (const filter of categories) {
  const url = new URL("https://api.wheelpros.com/products/v1/search/accessory");
  url.searchParams.set("filter", filter);
  url.searchParams.set("pageSize", "5");
  
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  const data = await res.json();
  console.log(`\n=== ${filter.toUpperCase()} === (${data.total || 0} results)`);
  
  if (data.results?.length) {
    data.results.slice(0, 3).forEach(r => {
      console.log(`  - ${r.sku}: ${r.title}`);
    });
  }
}
