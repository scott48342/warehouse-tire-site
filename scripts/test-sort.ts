async function test() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const res = await fetch(`${baseUrl}/api/wheels/fitment-search?year=2018&make=Lincoln&model=Navigator&modification=manual_b51f4fde16cc&diameter=22&sort=price_asc&pageSize=50&nocache=${Math.random()}`, {
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  });
  const data = await res.json();
  
  console.log('Total results:', data.totalCount);
  
  const results = data.results || [];
  
  // Log first result to see structure
  if (results[0]) {
    console.log('\nFirst result availability:', results[0].availability);
  }
  
  // Get prices from MSRP
  console.log('\nFirst 15 results (sorted by price_asc):');
  results.slice(0, 15).forEach((r: any, i: number) => {
    const price = Number(r.prices?.msrp?.[0]?.currencyAmount);
    const avail = r.availability?.label || 'unk';
    console.log(`  ${i+1}. $${price} [${avail}] - ${r.sku}`);
  });
  
  // Check if they're actually sorted
  const prices = results.slice(0, 15).map((r: any) => Number(r.prices?.msrp?.[0]?.currencyAmount));
  const isSorted = prices.every((p: number, i: number) => i === 0 || p >= prices[i-1]);
  console.log('\nIs sorted (low to high)?', isSorted);
  console.log('Prices:', prices.join(', '));
}
test();
