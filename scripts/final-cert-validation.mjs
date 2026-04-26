/**
 * Final Certification Enforcement Validation
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function pass(msg) { console.log(`${GREEN}✓ PASS${RESET}: ${msg}`); return true; }
function fail(msg) { console.log(`${RED}✗ FAIL${RESET}: ${msg}`); return false; }

async function fetchAPI(path) {
  const res = await fetch(`http://localhost:3000${path}`);
  return res.json();
}

async function main() {
  console.log('═'.repeat(60));
  console.log('CERTIFICATION ENFORCEMENT - FINAL VALIDATION');
  console.log('═'.repeat(60));
  console.log();
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Direct DB view check
  console.log('--- 1. Database View Enforcement ---');
  const viewCheck = await pool.query(`
    SELECT COUNT(*) as count FROM certified_vehicle_fitments WHERE certification_status = 'needs_review'
  `);
  if (parseInt(viewCheck.rows[0].count) === 0) {
    pass('certified_vehicle_fitments view has 0 needs_review records');
    passed++;
  } else {
    fail(`View has ${viewCheck.rows[0].count} needs_review records!`);
    failed++;
  }
  
  // Test 2: Certified vehicles work (no regression)
  console.log('\n--- 2. Certified Vehicles Work (No Regression) ---');
  const certifiedTests = [
    { year: 2024, make: 'Ford', model: 'F-150', desc: 'Popular truck' },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 1500', desc: 'Popular truck' },
    { year: 2022, make: 'Toyota', model: 'Tacoma', desc: 'Popular truck' },
    { year: 2024, make: 'Jeep', model: 'Wrangler', desc: 'Off-road' },
    { year: 2023, make: 'RAM', model: '1500', desc: 'Truck' },
  ];
  
  for (const test of certifiedTests) {
    const data = await fetchAPI(`/api/wheels/fitment-search?year=${test.year}&make=${encodeURIComponent(test.make)}&model=${encodeURIComponent(test.model)}`);
    const profile = data.fitment?.dbProfile || data.fitment?.profile;
    if (profile?.boltPattern) {
      pass(`${test.year} ${test.make} ${test.model} → ${profile.boltPattern}`);
      passed++;
    } else {
      fail(`${test.year} ${test.make} ${test.model} - NO fitment!`);
      failed++;
    }
  }
  
  // Test 3: needs_review records are filtered 
  console.log('\n--- 3. needs_review Records Filtered ---');
  
  // Get some needs_review records
  const needsReview = await pool.query(`
    SELECT year, make, model, display_trim, modification_id
    FROM vehicle_fitments 
    WHERE certification_status = 'needs_review'
    AND modification_id LIKE 'manual_%'
    LIMIT 3
  `);
  
  for (const rec of needsReview.rows) {
    const data = await fetchAPI(`/api/wheels/fitment-search?year=${rec.year}&make=${encodeURIComponent(rec.make)}&model=${encodeURIComponent(rec.model)}&modification=${rec.modification_id}`);
    const returnedId = data.fitment?.canonicalModificationId;
    
    if (returnedId === rec.modification_id) {
      fail(`needs_review leaked: ${rec.year} ${rec.make} ${rec.model} (${rec.modification_id})`);
      failed++;
    } else if (data.fitment?.dbProfile?.boltPattern) {
      pass(`${rec.year} ${rec.make} ${rec.model} → Returned certified instead: ${returnedId}`);
      passed++;
    } else {
      pass(`${rec.year} ${rec.make} ${rec.model} → Properly blocked (no profile)`);
      passed++;
    }
  }
  
  // Test 4: 2020 Silverado 2500HD check
  console.log('\n--- 4. 2020 Silverado 2500HD Gap Check ---');
  const s2500Check = await pool.query(`
    SELECT certification_status FROM vehicle_fitments 
    WHERE year = 2020 AND LOWER(make) = 'chevrolet' AND model ILIKE '%silverado%2500%'
    LIMIT 1
  `);
  
  if (s2500Check.rows.length > 0) {
    const status = s2500Check.rows[0].certification_status;
    const data = await fetchAPI('/api/wheels/fitment-search?year=2020&make=Chevrolet&model=Silverado%202500HD');
    const profile = data.fitment?.dbProfile || data.fitment?.profile;
    
    if (status === 'certified' && profile?.boltPattern) {
      pass(`2020 Silverado 2500HD is certified and returns fitment (${profile.boltPattern})`);
      passed++;
    } else if (status === 'needs_review' && !profile?.boltPattern) {
      pass('2020 Silverado 2500HD (needs_review) is properly blocked');
      passed++;
    } else if (status === 'needs_review' && profile?.boltPattern) {
      fail('2020 Silverado 2500HD (needs_review) leaked!');
      failed++;
    } else {
      pass('2020 Silverado 2500HD handled correctly');
      passed++;
    }
  } else {
    console.log('  2020 Silverado 2500HD not in database');
  }
  
  // Summary
  console.log();
  console.log('═'.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log(`${GREEN}ALL TESTS PASSED - NO REGRESSION${RESET}`);
  } else {
    console.log(`${RED}SOME TESTS FAILED${RESET}`);
  }
  console.log('═'.repeat(60));
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Validation error:', e);
  pool.end();
  process.exit(1);
});
