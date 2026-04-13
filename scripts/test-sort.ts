async function test() {
  const res = await fetch('https://shop.warehousetiredirect.com/api/wheels/fitment-search?year=2018&make=Lincoln&model=Navigator&modification=manual_b51f4fde16cc&diameter=22&sort=price_asc&pageSize=10&_cb=' + Date.now());
  const data = await res.json();
  
  // Check if sort param is being acknowledged
  console.log('Sort applied?', data.sortApplied || data.sort || 'unknown');
  console.log('Total results:', data.totalCount);
  
  console.log('\nFirst 10 prices:');
  const results = data.results || [];
  results.slice(0, 10).forEach((r: any, i: number) => {
    const price = r.sellPrice || r.prices?.msrp?.[0]?.currencyAmount;
    const brand = typeof r.brand === 'object' ? r.brand?.description : r.brand;
    console.log(`  ${i+1}. $${price?.toFixed?.(2) || price} - ${brand} ${r.techfeed?.style || r.sku}`);
  });
}
test();
