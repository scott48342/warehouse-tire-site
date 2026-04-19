import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_BASE = 'https://api.wheelpros.com';

async function main() {
  // Get token
  console.log('Getting token...');
  const tokenRes = await fetch(API_BASE + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName: process.env.WHEELPROS_USERNAME,
      password: process.env.WHEELPROS_PASSWORD
    })
  });
  
  const tokenData = await tokenRes.json();
  console.log('Token response:', JSON.stringify(tokenData, null, 2).slice(0, 500));
  
  if (!tokenData.access_token) {
    console.error('No token received!');
    return;
  }
  
  const token = tokenData.access_token;
  
  // Try accessory search with various params
  const searches = [
    '/products/v1/search/accessory?filter=cap',
    '/products/v1/search/accessory?filter=CAP',
    '/products/v1/search/accessory?filter=*',
    '/products/v1/search/accessory',
    '/products/v1/search/accessory?pageSize=10',
  ];
  
  for (const path of searches) {
    console.log('\n--- Trying:', path, '---');
    try {
      const res = await fetch(API_BASE + path, {
        headers: { 
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/json'
        }
      });
      
      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Response:', text.slice(0, 1000));
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
}

main().catch(e => console.error('Error:', e));
