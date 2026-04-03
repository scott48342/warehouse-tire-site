/**
 * Check WheelPros API response for pricing fields
 */
import 'dotenv/config';

const SKU = process.argv[2] || 'KM54289063718'; // KMC KM542 18x9

async function getToken() {
  const userName = process.env.WHEELPROS_USERNAME;
  const password = process.env.WHEELPROS_PASSWORD;
  
  if (!userName || !password) {
    throw new Error('Missing WHEELPROS_USERNAME or WHEELPROS_PASSWORD');
  }
  
  const res = await fetch('https://api.wheelpros.com/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  });
  
  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status}`);
  }
  
  const data = await res.json();
  return data.accessToken || data.token;
}

async function getProductBySku(token, sku) {
  // Try product detail endpoint
  const url = `https://api.wheelpros.com/product/v1/wheel/${sku}`;
  console.log(`Fetching: ${url}`);
  
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  
  if (!res.ok) {
    console.log(`Product detail failed: ${res.status}`);
    return null;
  }
  
  return res.json();
}

async function searchProducts(token, sku) {
  // Try search with price fields
  const url = `https://api.wheelpros.com/product/v1/wheel/search?sku=${sku}&fields=price,inventory,cost`;
  console.log(`Searching: ${url}`);
  
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  
  if (!res.ok) {
    console.log(`Search failed: ${res.status}`);
    return null;
  }
  
  return res.json();
}

async function main() {
  console.log(`Checking SKU: ${SKU}\n`);
  
  const token = await getToken();
  console.log('Got auth token\n');
  
  // Try direct product lookup
  const product = await getProductBySku(token, SKU);
  if (product) {
    console.log('=== Product Detail Response ===');
    console.log(JSON.stringify(product, null, 2));
    console.log('\n=== Pricing Fields ===');
    console.log('msrp:', product.msrp);
    console.log('mapPrice:', product.mapPrice);
    console.log('cost:', product.cost);
    console.log('dealerCost:', product.dealerCost);
    console.log('dealerPrice:', product.dealerPrice);
    console.log('price:', product.price);
    console.log('prices:', product.prices);
  }
  
  console.log('\n');
  
  // Try search
  const search = await searchProducts(token, SKU);
  if (search?.content?.[0]) {
    console.log('=== Search Response (first result) ===');
    console.log(JSON.stringify(search.content[0], null, 2));
  }
}

main().catch(console.error);
