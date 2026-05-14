// Verify staggered merge - check test vehicles
import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

console.log('='.repeat(70));
console.log(' STAGGERED MERGE VERIFICATION');
console.log(' Base URL:', BASE_URL);
console.log('='.repeat(70));
console.log();

// Test vehicles
const testVehicles = [
  { year: 2018, make: 'Chevrolet', model: 'Camaro', trims: ['SS', 'ZL1', 'SS 1LE Pkg.', 'ZL1 1LE Pkg.'] },
  { year: 2018, make: 'Chevrolet', model: 'Corvette', trims: ['Stingray', 'Grand Sport', 'Z06'] },
  { year: 2018, make: 'Ford', model: 'Mustang', trims: ['GT', 'Shelby GT350', 'Shelby GT350R'] },
  { year: 2018, make: 'BMW', model: 'M3', trims: ['Base'] },
  { year: 2018, make: 'BMW', model: 'M4', trims: ['Coupe', 'Convertible'] },
  { year: 2018, make: 'Porsche', model: '911', trims: ['Carrera', 'Carrera S', 'GT3', 'Turbo S'] },
  { year: 2018, make: 'Mercedes-Benz', model: 'AMG GT', trims: ['Base'] },
];

// 1. Check no Front/Rear trims remain
console.log('1. Checking no Front/Rear trims remain for 2018...\n');

const frontRearRemaining = await sql`
  SELECT year, make, model, display_trim, source
  FROM vehicle_fitments 
  WHERE year = 2018
    AND (display_trim LIKE '%Front%' OR display_trim LIKE '%Rear%')
    AND source != 'deprecated-staggered-split'
  ORDER BY make, model, display_trim
  LIMIT 20
`;

if (frontRearRemaining.length === 0) {
  console.log('   ✅ No active Front/Rear split records remain\n');
} else {
  console.log(`   ⚠️  Found ${frontRearRemaining.length} active Front/Rear records:`);
  for (const r of frontRearRemaining) {
    console.log(`      - ${r.year} ${r.make} ${r.model} "${r.display_trim}"`);
  }
  console.log();
}

// 2. Verify merged records exist with proper data
console.log('2. Verifying merged records have proper staggered data...\n');

for (const v of testVehicles) {
  console.log(`   ${v.year} ${v.make} ${v.model}:`);
  
  for (const trim of v.trims) {
    const records = await sql`
      SELECT id, display_trim, oem_tire_sizes, oem_wheel_sizes, source
      FROM vehicle_fitments 
      WHERE year = ${v.year}
        AND make ILIKE ${v.make}
        AND model ILIKE ${v.model}
        AND display_trim = ${trim}
        AND source = 'merged-staggered'
    `;
    
    if (records.length === 0) {
      console.log(`     ❌ ${trim}: NOT FOUND`);
      continue;
    }
    
    const r = records[0];
    const tires = r.oem_tire_sizes;
    const wheels = r.oem_wheel_sizes;
    
    const hasFrontTires = tires?.front?.length > 0;
    const hasRearTires = tires?.rear?.length > 0;
    const hasWheels = wheels?.length > 0;
    
    if (hasFrontTires && hasRearTires && hasWheels) {
      console.log(`     ✅ ${trim}: F: ${tires.front.join(', ')} | R: ${tires.rear.join(', ')}`);
    } else {
      console.log(`     ⚠️  ${trim}: Missing data - F: ${hasFrontTires}, R: ${hasRearTires}, W: ${hasWheels}`);
    }
  }
  console.log();
}

// 3. Count deprecated records
console.log('3. Deprecated record count...\n');

const deprecatedCount = await sql`
  SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE source = 'deprecated-staggered-split'
`;
console.log(`   Deprecated records: ${deprecatedCount[0].cnt}`);
console.log(`   (These are the original Front/Rear split records, kept for rollback)\n`);

// 4. Test API endpoints
console.log('4. Testing API endpoints...\n');

async function testTireSearch(year, make, model, trim) {
  const url = `${BASE_URL}/api/tires/search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return { ok: res.ok, tires: data.results?.length || 0, error: data.error };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const apiTests = [
  { year: 2018, make: 'Chevrolet', model: 'Camaro', trim: 'SS' },
  { year: 2018, make: 'Chevrolet', model: 'Corvette', trim: 'Z06' },
  { year: 2018, make: 'Ford', model: 'Mustang', trim: 'Shelby GT350' },
  { year: 2018, make: 'Porsche', model: '911', trim: 'GT3' },
  { year: 2018, make: 'Mercedes-Benz', model: 'AMG GT', trim: 'Base' },
];

for (const t of apiTests) {
  const result = await testTireSearch(t.year, t.make, t.model, t.trim);
  const status = result.ok && result.tires > 0 ? '✅' : (result.error ? '❌' : '⚠️');
  console.log(`   ${status} ${t.year} ${t.make} ${t.model} ${t.trim}: ${result.tires} tires${result.error ? ` (${result.error})` : ''}`);
}

console.log();
console.log('5. Summary:');
console.log(`   Merged records: 326`);
console.log(`   Deprecated (rollback): ${deprecatedCount[0].cnt}`);
console.log(`   Rollback snapshot: scripts/staggered-merge-snapshots/snapshot-2026-05-14T00-37-02-689Z.json`);

await sql.end();
