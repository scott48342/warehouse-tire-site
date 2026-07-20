// Search WheelPros for 16x7 and 17x8 5x139.7 (5x5.5) wheels

async function main() {
  // Get token
  const authRes = await fetch('https://api.wheelpros.com/auth/v1/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'scott@warehousetire.net', password: 'Websters1!' })
  });
  const authData = await authRes.json();
  const token = authData.access_token;
  console.log('Got auth token');
  
  // Search 16x7 5x139.7
  const url16 = 'https://api.wheelpros.com/products/v1/search/wheel?wheel_diameter=16&width=7&bolt_pattern_metric=5x139.7&pageSize=100';
  const res16 = await fetch(url16, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
  });
  const data16 = await res16.json();
  
  console.log('\n=== 16x7 5x139.7 (5x5.5) Wheels ===');
  console.log('Total:', data16.totalCount || 0);
  (data16.results || []).forEach(w => {
    const brand = w.brand?.description || w.brand || '';
    const style = w.title || '';
    const finish = w.properties?.finish || '';
    const sku = w.sku || '';
    const offset = w.properties?.offset;
    const msrp = w.prices?.msrp?.[0]?.value;
    console.log(`${brand} ${style} ${finish} | ${sku} | Offset: ${offset}mm | MSRP: $${msrp}`);
  });
  
  // Search 17x8 5x139.7
  const url17 = 'https://api.wheelpros.com/products/v1/search/wheel?wheel_diameter=17&width=8&bolt_pattern_metric=5x139.7&pageSize=100';
  const res17 = await fetch(url17, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
  });
  const data17 = await res17.json();
  
  console.log('\n=== 17x8 5x139.7 (5x5.5) Wheels ===');
  console.log('Total:', data17.totalCount || 0);
  (data17.results || []).forEach(w => {
    const brand = w.brand?.description || w.brand || '';
    const style = w.title || '';
    const finish = w.properties?.finish || '';
    const sku = w.sku || '';
    const offset = w.properties?.offset;
    const msrp = w.prices?.msrp?.[0]?.value;
    console.log(`${brand} ${style} ${finish} | ${sku} | Offset: ${offset}mm | MSRP: $${msrp}`);
  });
}

main().catch(e => console.error(e));
