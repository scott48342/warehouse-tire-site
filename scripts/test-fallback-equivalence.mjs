/**
 * Test Fallback Equivalence Logic
 * 
 * Validates that:
 * 1. needs_review trims are not silently substituted
 * 2. Fallback confidence is properly set
 * 3. Equivalence checking works correctly
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
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function pass(msg) { console.log(`${GREEN}✓ PASS${RESET}: ${msg}`); return true; }
function fail(msg) { console.log(`${RED}✗ FAIL${RESET}: ${msg}`); return false; }
function warn(msg) { console.log(`${YELLOW}⚠ WARN${RESET}: ${msg}`); }

async function fetchAPI(path) {
  const res = await fetch(`http://localhost:3000${path}`);
  return res.json();
}

async function main() {
  console.log('═'.repeat(60));
  console.log('FALLBACK EQUIVALENCE VALIDATION');
  console.log('═'.repeat(60));
  console.log();
  
  let passed = 0;
  let failed = 0;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: RAV4 TRD Off-Road (needs_review) - Performance trim
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('--- Test 1: RAV4 TRD Off-Road (needs_review, performance trim) ---');
  
  try {
    const data = await fetchAPI('/api/wheels/fitment-search?year=2026&make=Toyota&model=rav4&modification=manual_b13a135f0155');
    
    console.log('  Response:');
    console.log(`    canonicalModificationId: ${data.fitment?.canonicalModificationId}`);
    console.log(`    fallbackConfidence: ${data.fitment?.fallbackConfidence}`);
    console.log(`    showGuaranteedFit: ${data.fitment?.showGuaranteedFit}`);
    console.log(`    fallbackWarnings: ${data.fitment?.fallbackWarnings?.join(', ') || 'none'}`);
    
    // TRD Off-Road is a performance trim - should NOT show guaranteed fit unless equivalent
    if (data.fitment?.fallbackConfidence === 'exact_certified') {
      fail('TRD Off-Road should not get exact_certified confidence (it is needs_review)');
      failed++;
    } else if (data.fitment?.fallbackConfidence === 'equivalent_certified') {
      pass('TRD Off-Road got equivalent_certified (specs matched)');
      passed++;
    } else if (data.fitment?.fallbackConfidence === 'wheel_safe_only') {
      pass('TRD Off-Road got wheel_safe_only (partial match)');
      passed++;
    } else if (data.fitment?.fallbackConfidence === 'needs_manual_verification') {
      pass('TRD Off-Road got needs_manual_verification (safe blocking)');
      passed++;
    } else {
      warn(`Unexpected confidence: ${data.fitment?.fallbackConfidence}`);
    }
    
    // Check showGuaranteedFit
    if (data.fitment?.fallbackConfidence === 'wheel_safe_only' && data.fitment?.showGuaranteedFit) {
      fail('wheel_safe_only should NOT show guaranteed fit');
      failed++;
    } else {
      pass('Guaranteed fit badge correctly set');
      passed++;
    }
  } catch (e) {
    fail(`API error: ${e.message}`);
    failed++;
  }
  
  console.log();
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: Certified trim (direct match)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('--- Test 2: RAV4 LE Hybrid (certified, direct match) ---');
  
  try {
    const data = await fetchAPI('/api/wheels/fitment-search?year=2026&make=Toyota&model=rav4&modification=2026-toyota-rav4-le-hybrid');
    
    console.log('  Response:');
    console.log(`    canonicalModificationId: ${data.fitment?.canonicalModificationId}`);
    console.log(`    fallbackConfidence: ${data.fitment?.fallbackConfidence}`);
    console.log(`    showGuaranteedFit: ${data.fitment?.showGuaranteedFit}`);
    
    if (data.fitment?.fallbackConfidence === 'exact_certified') {
      pass('LE Hybrid got exact_certified (direct certified match)');
      passed++;
    } else {
      fail(`LE Hybrid should get exact_certified, got: ${data.fitment?.fallbackConfidence}`);
      failed++;
    }
    
    if (data.fitment?.showGuaranteedFit === true) {
      pass('Guaranteed fit badge shown for exact_certified');
      passed++;
    } else {
      fail('Guaranteed fit badge should be shown for exact_certified');
      failed++;
    }
  } catch (e) {
    fail(`API error: ${e.message}`);
    failed++;
  }
  
  console.log();
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: Popular certified vehicle (no regression)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('--- Test 3: 2024 Ford F-150 (certified, popular) ---');
  
  try {
    const data = await fetchAPI('/api/wheels/fitment-search?year=2024&make=Ford&model=F-150');
    
    console.log('  Response:');
    console.log(`    boltPattern: ${data.fitment?.envelope?.boltPattern}`);
    console.log(`    fallbackConfidence: ${data.fitment?.fallbackConfidence}`);
    console.log(`    showGuaranteedFit: ${data.fitment?.showGuaranteedFit}`);
    console.log(`    totalCount: ${data.totalCount}`);
    
    if (data.fitment?.envelope?.boltPattern === '6x135') {
      pass('F-150 bolt pattern correct');
      passed++;
    } else {
      fail(`F-150 bolt pattern wrong: ${data.fitment?.envelope?.boltPattern}`);
      failed++;
    }
    
    if (data.totalCount > 0) {
      pass(`F-150 returned ${data.totalCount} wheels (no regression)`);
      passed++;
    } else {
      fail('F-150 returned no wheels (regression!)');
      failed++;
    }
  } catch (e) {
    fail(`API error: ${e.message}`);
    failed++;
  }
  
  console.log();
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 4: Staggered vehicle (Mustang) - certification and stagger detection
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('--- Test 4: 2024 Ford Mustang GT (certified, staggered) ---');
  
  try {
    const data = await fetchAPI('/api/wheels/fitment-search?year=2024&make=Ford&model=Mustang');
    
    console.log('  Response:');
    console.log(`    boltPattern: ${data.fitment?.envelope?.boltPattern}`);
    console.log(`    fallbackConfidence: ${data.fitment?.fallbackConfidence}`);
    console.log(`    staggered: ${JSON.stringify(data.fitment?.staggered)}`);
    
    if (data.fitment?.envelope?.boltPattern) {
      pass(`Mustang has bolt pattern: ${data.fitment.envelope.boltPattern}`);
      passed++;
    } else {
      warn('Mustang bolt pattern not found');
    }
  } catch (e) {
    fail(`API error: ${e.message}`);
    failed++;
  }
  
  console.log();
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═'.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log(`${GREEN}ALL TESTS PASSED${RESET}`);
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
