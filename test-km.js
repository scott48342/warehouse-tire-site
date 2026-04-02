require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.KM_API_KEY || process.env.KMTIRE_API_KEY || process.env.KM_TIRE_API_KEY || "";

console.log('K&M API Key configured:', apiKey ? `Yes (${apiKey.slice(0,8)}...)` : 'NO - not set');

if (!apiKey) {
  console.log('\nK&M API will not return results without KM_API_KEY in .env.local');
  console.log('Current K&M env vars:');
  Object.keys(process.env).filter(k => k.startsWith('KM')).forEach(k => {
    console.log(`  ${k}: ${process.env[k].slice(0,20)}...`);
  });
  process.exit(0);
}

// Test the API
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<InventoryRequest>
<Credentials><APIKey>${apiKey}</APIKey></Credentials>
<Item><TireSize>1956015</TireSize></Item>
</InventoryRequest>`;

fetch("https://api.kmtire.com/v1/tiresizesearch", {
  method: "POST",
  headers: { "content-type": "application/xml", accept: "application/xml" },
  body: xml,
}).then(r => r.text()).then(text => {
  console.log('\nK&M Response (first 1500 chars):');
  console.log(text.slice(0, 1500));
}).catch(e => console.error('Error:', e));
