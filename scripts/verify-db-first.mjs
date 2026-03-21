/**
 * Verify DB-first fitment for 3 vehicles
 */

const BASE_URL = 'https://shop.warehousetiredirect.com';

const VEHICLES = [
  { year: 2009, make: 'Jeep', model: 'Wrangler', label: '2009 Jeep Wrangler Rubicon' },
  { year: 1995, make: 'Chevrolet', model: 'Camaro', label: '1995 Camaro' },
  { year: 2020, make: 'Chevrolet', model: 'Silverado 1500', label: '2020 Chevy Silverado 1500 (GM Truck)' },
];

async function testVehicle(vehicle) {
  const { year, make, model, label } = vehicle;
  const url = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&pageSize=1&debug=1`;
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Testing: ${label}`);
  console.log(`${'═'.repeat(60)}`);
  
  // Request 1 - may import from API
  console.log('\n📤 Request 1...');
  const t1 = Date.now();
  const res1 = await fetch(url);
  const data1 = await res1.json();
  const ms1 = Date.now() - t1;
  
  if (data1.error) {
    console.log(`❌ ERROR: ${data1.error}`);
    return null;
  }
  
  const profile1 = data1.fitment?.dbProfile;
  console.log(`   Status: ${res1.status} (${ms1}ms)`);
  console.log(`   dbProfile: ${profile1 ? '✅ PRESENT' : '⚠️ MISSING'}`);
  
  if (profile1) {
    console.log(`   └─ modificationId: ${profile1.modificationId}`);
    console.log(`   └─ displayTrim: ${profile1.displayTrim}`);
    console.log(`   └─ boltPattern: ${profile1.boltPattern}`);
    console.log(`   └─ centerBoreMm: ${profile1.centerBoreMm}`);
    console.log(`   └─ threadSize: ${profile1.threadSize}`);
    console.log(`   └─ offsetRange: ${JSON.stringify(profile1.offsetRange)}`);
    console.log(`   └─ oemTireSizes: ${JSON.stringify(profile1.oemTireSizes?.slice(0, 3))}${profile1.oemTireSizes?.length > 3 ? '...' : ''}`);
    console.log(`   └─ source: ${profile1.source}`);
  }
  
  // Request 2 - should be DB HIT
  console.log('\n📤 Request 2 (should be DB HIT)...');
  const t2 = Date.now();
  const res2 = await fetch(url);
  const data2 = await res2.json();
  const ms2 = Date.now() - t2;
  
  const profile2 = data2.fitment?.dbProfile;
  console.log(`   Status: ${res2.status} (${ms2}ms)`);
  console.log(`   dbProfile.source: ${profile2?.source || 'N/A'}`);
  console.log(`   ${ms2 < ms1 ? '✅ FASTER (likely DB HIT)' : '⚠️ Similar timing'}`);
  
  return profile1 || profile2;
}

async function main() {
  console.log('DB-First Fitment Verification');
  console.log('Base URL:', BASE_URL);
  
  const profiles = {};
  
  for (const v of VEHICLES) {
    profiles[v.label] = await testVehicle(v);
  }
  
  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'═'.repeat(60)}`);
  
  for (const [label, profile] of Object.entries(profiles)) {
    if (profile) {
      console.log(`\n✅ ${label}`);
      console.log(`   Bolt: ${profile.boltPattern} | CB: ${profile.centerBoreMm}mm | Thread: ${profile.threadSize}`);
    } else {
      console.log(`\n❌ ${label} - No profile`);
    }
  }
  
  // Accessory fitment fields
  console.log(`\n${'═'.repeat(60)}`);
  console.log('ACCESSORY FITMENT FIELDS (from dbProfile)');
  console.log(`${'═'.repeat(60)}`);
  console.log(`
Lug Nut Matching:
  - threadSize: e.g., "M14x1.5", "M12x1.25"
  - seatType: e.g., "conical", "ball", "flat"
  
Hub Ring Matching:
  - centerBoreMm: e.g., 71.5, 78.1
  - (wheel center bore from selected wheel)
`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
