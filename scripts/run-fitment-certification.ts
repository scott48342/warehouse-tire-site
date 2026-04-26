/**
 * PHASE 2: Canonical Fitment Certification Runner
 * 
 * This is the SINGLE SOURCE OF TRUTH for fitment certification.
 * 
 * USAGE:
 *   npx tsx scripts/run-fitment-certification.ts [options]
 * 
 * OPTIONS:
 *   --dry-run       Don't write changes
 *   --all           Process all records (not just needs_review)
 *   --verbose       Show detailed progress
 *   --report        Just show current status report
 *   --ids=a,b,c     Process specific IDs only
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Import from relative path since this is a standalone script
import { runCertification, getCertificationReport } from '../src/lib/certification/runner';
import { CERTIFICATION_VERSION } from '../src/lib/certification/types';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const processAll = args.includes('--all');
  const verbose = args.includes('--verbose');
  const reportOnly = args.includes('--report');
  
  const idsArg = args.find(a => a.startsWith('--ids='));
  const ids = idsArg ? idsArg.split('=')[1].split(',') : undefined;
  
  console.log('='.repeat(70));
  console.log('FITMENT CERTIFICATION RUNNER');
  console.log('='.repeat(70));
  console.log(`Version: ${CERTIFICATION_VERSION}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');
  
  if (reportOnly) {
    // Just show current status
    const report = await getCertificationReport(pool);
    
    console.log('📊 CURRENT STATUS');
    console.log('-'.repeat(40));
    console.log(`Total records:    ${report.totals.total}`);
    console.log(`✅ Certified:     ${report.totals.certified} (${report.totals.certifiedPct.toFixed(2)}%)`);
    console.log(`⚠️  Needs Review: ${report.totals.needsReview}`);
    console.log(`🚫 Quarantined:   ${report.totals.quarantined}`);
    console.log('');
    
    console.log('📋 BY ERROR TYPE');
    console.log('-'.repeat(40));
    for (const [type, count] of Object.entries(report.byErrorType)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log('');
    
    console.log('🏁 TOP OFFENDERS');
    console.log('-'.repeat(40));
    for (const o of report.topOffenders.slice(0, 10)) {
      console.log(`  ${o.make} ${o.model}: ${o.count}`);
    }
    
  } else {
    // Run certification
    console.log('Running certification...');
    console.log('');
    
    const stats = await runCertification({
      pool,
      ids,
      dryRun,
      processAll,
      verbose,
      batchSize: 100,
    });
    
    console.log('');
    console.log('📊 CERTIFICATION RESULTS');
    console.log('-'.repeat(40));
    console.log(`Processed:        ${stats.processed}`);
    console.log(`✅ Certified:     ${stats.certified}`);
    console.log(`⚠️  Needs Review: ${stats.needsReview}`);
    console.log(`🚫 Quarantined:   ${stats.quarantined}`);
    console.log('');
    
    if (Object.keys(stats.errors).length > 0) {
      console.log('📋 ERRORS BY TYPE');
      console.log('-'.repeat(40));
      for (const [type, count] of Object.entries(stats.errors).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
      }
    }
    
    // Show final status
    console.log('');
    const report = await getCertificationReport(pool);
    console.log('📈 FINAL STATUS');
    console.log('-'.repeat(40));
    console.log(`Total:            ${report.totals.total}`);
    console.log(`✅ Certified:     ${report.totals.certified} (${report.totals.certifiedPct.toFixed(2)}%)`);
    console.log(`⚠️  Needs Review: ${report.totals.needsReview}`);
    console.log(`🚫 Quarantined:   ${report.totals.quarantined}`);
  }
  
  console.log('');
  console.log('='.repeat(70));
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
