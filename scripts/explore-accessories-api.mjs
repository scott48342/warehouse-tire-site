import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_BASE = 'https://api.wheelpros.com';
let token = null;

async function getToken() {
  if (token) return token;
  
  const res = await fetch(API_BASE + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName: process.env.WHEELPROS_USERNAME,
      password: process.env.WHEELPROS_PASSWORD
    })
  });
  
  const data = await res.json();
  token = data.access_token;
  return token;
}

async function searchAccessories(filter, pageSize = 50) {
  const t = await getToken();
  const url = new URL(API_BASE + '/products/v1/search/accessory');
  url.searchParams.set('filter', filter);
  url.searchParams.set('fields', 'inventory,price,media');
  url.searchParams.set('priceType', 'msrp,map,nip');
  url.searchParams.set('company', '1500');
  url.searchParams.set('pageSize', String(pageSize));
  
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': 'Bearer ' + t, 'Accept': 'application/json' }
  });
  
  return res.json();
}

async function main() {
  const categories = [
    { name: 'center-cap', filter: 'center cap' },
    { name: 'hub-ring', filter: 'hub ring' },
    { name: 'hub-centric', filter: 'hub centric' },
    { name: 'lug-nut', filter: 'lug nut' },
    { name: 'lug-kit', filter: 'lug kit' },
    { name: 'led', filter: 'LED' },
    { name: 'light-bar', filter: 'light bar' },
    { name: 'rock-light', filter: 'rock light' },
    { name: 'pod-light', filter: 'pod light' },
    { name: 'tpms', filter: 'TPMS' },
    { name: 'valve-stem', filter: 'valve stem' },
    { name: 'wheel-lock', filter: 'wheel lock' },
    { name: 'spacer', filter: 'wheel spacer' },
  ];
  
  console.log('=== ACCESSORY CATEGORIES ===\n');
  
  const summary = [];
  
  for (const cat of categories) {
    try {
      const data = await searchAccessories(cat.filter, 5);
      const total = data.total || 0;
      
      console.log(`${cat.name.toUpperCase()} (total: ${total})`);
      
      if (data.results && data.results.length > 0) {
        const sample = data.results[0];
        console.log('  Sample SKU:', sample.sku);
        console.log('  Title:', sample.title);
        console.log('  Brand:', sample.brand?.description || sample.brand?.code);
        console.log('  MSRP:', sample.prices?.msrp?.[0]?.currencyAmount);
        
        // Check for bolt pattern or other specs in title
        const bpMatch = sample.title?.match(/(\d)X(\d{3}(?:\.\d)?)/i);
        if (bpMatch) console.log('  Bolt Pattern:', `${bpMatch[1]}x${bpMatch[2]}`);
      }
      console.log('');
      
      summary.push({ category: cat.name, count: total });
    } catch (err) {
      console.log(`${cat.name.toUpperCase()}: ERROR - ${err.message}\n`);
    }
  }
  
  console.log('\n=== SUMMARY ===');
  summary.forEach(s => console.log(`${s.category}: ${s.count}`));
  console.log('TOTAL:', summary.reduce((a, b) => a + b.count, 0));
}

main().catch(e => console.error('Error:', e.message));
