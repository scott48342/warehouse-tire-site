import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const API_KEY = process.env.WHEELPROS_API_KEY;
const BASE_URL = 'https://api.wheelpros.com/products/v1';

const sku = process.argv[2] || 'FC403PB20905001';

async function searchSku() {
  console.log(`Searching WheelPros API for SKU: ${sku}\n`);
  
  // Try the wheel search endpoint
  const url = `${BASE_URL}/search/wheel?partNumber=${encodeURIComponent(sku)}`;
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.ok) {
    console.log(`API Error: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(text);
    return;
  }
  
  const data = await res.json();
  console.log(`Total results: ${data.totalResults || data.results?.length || 0}`);
  
  if (data.results && data.results.length > 0) {
    for (const r of data.results.slice(0, 5)) {
      console.log(`\nSKU: ${r.sku}`);
      console.log(`  Title: ${r.title}`);
      console.log(`  Brand: ${r.brand?.description}`);
      console.log(`  MSRP: $${r.prices?.msrp?.[0]?.currencyAmount || 'N/A'}`);
      console.log(`  Inventory Type: ${r.inventory?.type || 'N/A'}`);
    }
  } else {
    console.log('No results found');
  }
}

searchSku().catch(console.error);
