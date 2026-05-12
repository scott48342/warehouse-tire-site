/**
 * REGRESSION TEST: Wheel Search Must Use vehicle_fitments
 * 
 * Added: 2026-05-12 after critical bug fix (commit dc2d613)
 * 
 * RULE: If vehicle_fitments has certified records for a YMM,
 * wheel search must NEVER return "no fitment data" solely because
 * the legacy vehicles table is empty.
 * 
 * This test catches the bug where wheel search was querying empty
 * legacy tables instead of vehicle_fitments (37,000+ records).
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function runRegressionTest() {
  console.log('='.repeat(70));
  console.log('REGRESSION TEST: Wheel Search Uses vehicle_fitments');
  console.log('='.repeat(70));
  console.log('');

  // Connect to DB to get sample vehicles from vehicle_fitments
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Get 20 random certified vehicles from vehicle_fitments
  const sampleQuery = await pool.query(`
    SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm
    FROM (
      SELECT DISTINCT ON (year, make, model) year, make, model, display_trim, bolt_pattern, center_bore_mm
      FROM vehicle_fitments
      WHERE certification_status = 'certified'
      AND bolt_pattern IS NOT NULL
      AND center_bore_mm IS NOT NULL
    ) sub
    ORDER BY RANDOM()
    LIMIT 20
  `);

  console.log(`Testing ${sampleQuery.rows.length} random vehicles from vehicle_fitments...\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const row of sampleQuery.rows) {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${row.year}&make=${encodeURIComponent(row.make)}&model=${encodeURIComponent(row.model)}`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      
      // CRITICAL CHECK: If vehicle_fitments has this vehicle, wheel search must not block it
      if (data.blocked || data.profileNotFound) {
        failed++;
        failures.push({
          vehicle: `${row.year} ${row.make} ${row.model}`,
          dbBolt: row.bolt_pattern,
          dbHub: row.center_bore_mm,
          blocked: data.blocked,
          profileNotFound: data.profileNotFound,
          blockReason: data.blockReason,
        });
        console.log(`❌ FAIL: ${row.year} ${row.make} ${row.model}`);
        console.log(`   DB has: ${row.bolt_pattern}, ${row.center_bore_mm}mm hub`);
        console.log(`   API returned blocked=${data.blocked} profileNotFound=${data.profileNotFound}`);
        if (data.blockReason) console.log(`   Reason: ${data.blockReason}`);
      } else {
        passed++;
        console.log(`✅ PASS: ${row.year} ${row.make} ${row.model} → ${data.totalCount} wheels`);
      }
    } catch (err) {
      failed++;
      console.log(`❌ ERROR: ${row.year} ${row.make} ${row.model} - ${err.message}`);
    }
  }

  await pool.end();

  console.log('\n' + '='.repeat(70));
  console.log(`RESULT: ${passed}/${sampleQuery.rows.length} passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.log('\n⚠️  REGRESSION DETECTED!');
    console.log('Vehicles exist in vehicle_fitments but wheel search is blocking them.');
    console.log('This indicates the legacy table fallback bug may have returned.');
    console.log('\nFailed vehicles:');
    failures.forEach(f => {
      console.log(`  - ${f.vehicle} (${f.dbBolt}, ${f.dbHub}mm)`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ No regression detected. Wheel search correctly uses vehicle_fitments.');
    process.exit(0);
  }
}

runRegressionTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
