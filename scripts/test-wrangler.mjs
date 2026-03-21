// Test 2009 Jeep Wrangler fitment import

const baseUrl = 'http://127.0.0.1:3001';

async function test() {
  console.log('Testing 2009 Jeep Wrangler Rubicon fitment import...\n');
  
  // First request - should fetch from API and import
  console.log('Request 1 (should trigger API fetch + import):');
  const url1 = `${baseUrl}/api/wheels/fitment-search?year=2009&make=Jeep&model=Wrangler&pageSize=1`;
  
  try {
    const res1 = await fetch(url1);
    const data1 = await res1.json();
    
    if (data1.error) {
      console.log('ERROR:', data1.error);
      return;
    }
    
    console.log('Status:', res1.status);
    console.log('dbProfile:', data1.fitment?.dbProfile ? {
      modificationId: data1.fitment.dbProfile.modificationId,
      displayTrim: data1.fitment.dbProfile.displayTrim,
      boltPattern: data1.fitment.dbProfile.boltPattern,
      offsetRange: data1.fitment.dbProfile.offsetRange,
      oemTireSizes: data1.fitment.dbProfile.oemTireSizes?.slice(0, 3),
      source: data1.fitment.dbProfile.source,
    } : 'null');
    console.log('Wheels returned:', data1.results?.length || 0);
    
    // Second request - should be a DB HIT
    console.log('\nRequest 2 (should be DB HIT):');
    const res2 = await fetch(url1);
    const data2 = await res2.json();
    
    console.log('Status:', res2.status);
    console.log('dbProfile source:', data2.fitment?.dbProfile?.source || 'null');
    
    console.log('\n✅ Test complete!');
  } catch (e) {
    console.error('Fetch failed:', e.message);
  }
}

test();
