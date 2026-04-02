/**
 * Test what the WheelPros submodels API actually returns
 */

require('dotenv').config({ path: '.env.local' });

const tierAVehicles = [
  { year: 2020, make: 'Ford', model: 'Mustang' },
  { year: 2020, make: 'Chevrolet', model: 'Camaro' },
  { year: 2020, make: 'Dodge', model: 'Challenger' },
  { year: 2020, make: 'Dodge', model: 'Charger' },
  { year: 2015, make: 'Ford', model: 'F-250' },
];

async function testWheelProsSingleVehicle(year, make, model) {
  const url = `http://localhost:3000/api/wp/vehicles/submodels?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
  
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('WHEELPROS SUBMODELS API TEST');
  console.log('(Tests what the SteppedVehicleSelector/VisualFitmentLauncher would see)');
  console.log('='.repeat(80));
  console.log('\nNote: Server must be running on localhost:3000\n');

  for (const v of tierAVehicles) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`${v.year} ${v.make} ${v.model}`);
    console.log(`${'─'.repeat(80)}`);
    
    const result = await testWheelProsSingleVehicle(v.year, v.make, v.model);
    
    if (!result.success) {
      console.log(`  ❌ API Error: ${result.error}`);
      continue;
    }
    
    const wpResults = result.data?.results || [];
    if (wpResults.length === 0) {
      console.log(`  📭 WheelPros returned EMPTY → Selector will use FITMENT DB trims`);
    } else {
      console.log(`  📦 WheelPros returned ${wpResults.length} submodel(s):`);
      for (const r of wpResults.slice(0, 10)) {
        console.log(`     • "${r.label}" (value: ${r.value})`);
      }
      if (wpResults.length > 10) {
        console.log(`     ... and ${wpResults.length - 10} more`);
      }
      console.log(`  ⚠️  These will be shown INSTEAD of Tier A fitment trims!`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('Without server, run this manually:');
  console.log('='.repeat(80));
  console.log(`
For each vehicle, the selector makes this call:
  /api/wp/vehicles/submodels?year=YEAR&make=MAKE&model=MODEL

Which proxies to WheelPros API:
  GET https://api.wheelpros.com/vehicles/v1/years/{year}/makes/{make}/models/{model}/submodels

If WheelPros returns ANY results, those are used and fitment DB is skipped.
`);
}

main();
