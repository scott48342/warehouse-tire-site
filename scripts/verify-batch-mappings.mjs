/**
 * Verify batch-created trim mappings
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function verify() {
  console.log("═".repeat(60));
  console.log("BATCH MAPPING VERIFICATION");
  console.log("═".repeat(60));
  
  // 1. Count mappings by status
  const statusRes = await pool.query(`
    SELECT status, COUNT(*) as cnt
    FROM wheel_size_trim_mappings
    GROUP BY status
    ORDER BY cnt DESC
  `);
  console.log('\n1. ALL MAPPINGS BY STATUS:');
  statusRes.rows.forEach(r => console.log('   ' + r.status + ': ' + r.cnt));

  // 2. Verify needs_review flag for batch-created
  const reviewRes = await pool.query(`
    SELECT needs_review, COUNT(*) as cnt
    FROM wheel_size_trim_mappings
    WHERE match_method = 'single_default_batch'
    GROUP BY needs_review
  `);
  console.log('\n2. NEEDS_REVIEW (batch created only):');
  reviewRes.rows.forEach(r => console.log('   needs_review=' + r.needs_review + ': ' + r.cnt));

  // 3. Verify has_single_config (implies showSizeChooser=false)
  const configRes = await pool.query(`
    SELECT has_single_config, COUNT(*) as cnt
    FROM wheel_size_trim_mappings
    WHERE match_method = 'single_default_batch'
    GROUP BY has_single_config
  `);
  console.log('\n3. HAS_SINGLE_CONFIG (showSizeChooser=false when true):');
  configRes.rows.forEach(r => console.log('   has_single_config=' + r.has_single_config + ': ' + r.cnt));

  // 4. Check for any auto-approved (should be 0)
  const approvedRes = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM wheel_size_trim_mappings
    WHERE match_method = 'single_default_batch'
    AND status = 'approved'
  `);
  console.log('\n4. AUTO-APPROVED (should be 0): ' + approvedRes.rows[0].cnt);
  if (parseInt(approvedRes.rows[0].cnt) > 0) {
    console.log('   ❌ ERROR: Found auto-approved mappings!');
  } else {
    console.log('   ✅ PASS: No auto-approvals');
  }

  // 5. Sample 5 created mappings
  const sampleRes = await pool.query(`
    SELECT year, make, model, our_trim, status, needs_review, has_single_config, 
           default_wheel_diameter, match_confidence
    FROM wheel_size_trim_mappings
    WHERE match_method = 'single_default_batch'
    ORDER BY year DESC, make, model
    LIMIT 5
  `);
  console.log('\n5. SAMPLE CREATED MAPPINGS (5):');
  sampleRes.rows.forEach(r => {
    console.log('   ' + r.year + ' ' + r.make + ' ' + r.model + ' ' + r.our_trim);
    console.log('     status=' + r.status + ', needs_review=' + r.needs_review + ', has_single_config=' + r.has_single_config);
    console.log('     diameter=' + r.default_wheel_diameter + '", confidence=' + r.match_confidence);
  });

  // 6. Breakdown by make
  const makeRes = await pool.query(`
    SELECT make, COUNT(*) as cnt
    FROM wheel_size_trim_mappings
    WHERE match_method = 'single_default_batch'
    GROUP BY make
    ORDER BY cnt DESC
    LIMIT 10
  `);
  console.log('\n6. BREAKDOWN BY MAKE (batch):');
  makeRes.rows.forEach(r => console.log('   ' + r.make + ': ' + r.cnt));

  // 7. Breakdown by confidence
  const confRes = await pool.query(`
    SELECT match_confidence, COUNT(*) as cnt
    FROM wheel_size_trim_mappings
    WHERE match_method = 'single_default_batch'
    GROUP BY match_confidence
  `);
  console.log('\n7. CONFIDENCE BREAKDOWN (batch):');
  confRes.rows.forEach(r => console.log('   ' + r.match_confidence + ': ' + r.cnt));

  // 8. Total batch count
  const totalRes = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM wheel_size_trim_mappings
    WHERE match_method = 'single_default_batch'
  `);
  console.log('\n8. TOTAL BATCH MAPPINGS: ' + totalRes.rows[0].cnt);

  await pool.end();
  
  console.log("\n" + "═".repeat(60));
  console.log("VERIFICATION COMPLETE");
  console.log("═".repeat(60));
}

verify().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
