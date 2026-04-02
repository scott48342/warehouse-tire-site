/**
 * Compare WheelPros submodels vs Fitment DB trims
 * This reveals why some vehicles show only "Base"
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const tierAVehicles = [
  { year: 2020, make: 'Ford', model: 'Mustang' },
  { year: 2020, make: 'Chevrolet', model: 'Camaro' },
  { year: 2020, make: 'Dodge', model: 'Challenger' },
  { year: 2020, make: 'Dodge', model: 'Charger' },
  { year: 2015, make: 'Ford', model: 'F-250' },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('WHEELPROS vs FITMENT DB TRIM COMPARISON');
  console.log('='.repeat(80));
  console.log('\nThe SteppedVehicleSelector tries WheelPros FIRST, and only');
  console.log('falls back to fitment DB if WheelPros returns no results.\n');

  for (const v of tierAVehicles) {
    const normalizedMake = v.make.toLowerCase();
    const normalizedModel = v.model.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`${v.year} ${v.make} ${v.model}`);
    console.log(`${'─'.repeat(80)}`);

    // Check WheelPros submodels (wpvehicles table)
    console.log('\n📦 WHEELPROS (wpvehicles table):');
    const wpRes = await pool.query(`
      SELECT DISTINCT submodel, submodel_id
      FROM wpvehicles
      WHERE year = $1 
        AND LOWER(make) = $2 
        AND (
          LOWER(model) = $3 
          OR LOWER(REPLACE(model, ' ', '-')) = $3
        )
      ORDER BY submodel
    `, [v.year, normalizedMake, normalizedModel]);
    
    if (wpRes.rows.length === 0) {
      console.log('   ❌ NO WHEELPROS SUBMODELS (will fall back to fitment DB)');
    } else {
      console.log(`   Found ${wpRes.rows.length} submodel(s):`);
      for (const r of wpRes.rows) {
        console.log(`   • "${r.submodel}" (id: ${r.submodel_id})`);
      }
    }

    // Check Fitment DB trims
    console.log('\n🔧 FITMENT DB (vehicle_fitments table):');
    const dbRes = await pool.query(`
      SELECT DISTINCT display_trim, modification_id, source
      FROM vehicle_fitments
      WHERE year = $1 AND make = $2 AND model = $3
      ORDER BY display_trim
    `, [v.year, normalizedMake, normalizedModel]);
    
    if (dbRes.rows.length === 0) {
      console.log('   ❌ NO FITMENT DB TRIMS');
    } else {
      console.log(`   Found ${dbRes.rows.length} trim(s):`);
      for (const r of dbRes.rows) {
        const isTierA = r.source === 'tier-a-import';
        console.log(`   • "${r.display_trim}" (${r.source})${isTierA ? ' ← Tier A' : ''}`);
      }
    }

    // Verdict
    console.log('\n📊 SELECTOR BEHAVIOR:');
    if (wpRes.rows.length > 0) {
      console.log(`   ⚠️ WheelPros has ${wpRes.rows.length} submodels → UI will show WHEELPROS data`);
      console.log(`   Fitment DB Tier A trims are IGNORED because WheelPros takes precedence!`);
    } else {
      console.log(`   ✅ No WheelPros data → UI will show FITMENT DB trims (including Tier A)`);
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('ROOT CAUSE ANALYSIS');
  console.log('='.repeat(80));
  console.log(`
The issue: SteppedVehicleSelector.tsx (lines 140-178) has this logic:

  1. Try WheelPros submodels API first
  2. If WheelPros returns results → use them and RETURN (skip fitment DB)
  3. Only if WheelPros returns nothing → fall back to fitment DB trims

This means Tier A trims are NEVER shown for vehicles that exist in WheelPros!

FIX OPTIONS:
1. Merge WheelPros + Fitment DB trims (show both)
2. Prefer Fitment DB for Tier A vehicles
3. For Tier A models, skip WheelPros entirely

SAFEST FIX: For known Tier A models, skip the WheelPros lookup and go
straight to fitment DB. This preserves existing behavior for other vehicles.
`);

  await pool.end();
}

main().catch(console.error);
