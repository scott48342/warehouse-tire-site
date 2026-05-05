/**
 * Dry-Run Bulk Approval Test
 * 
 * Tests the eligibility criteria for bulk approval without making changes.
 * 
 * Run: node scripts/dry-run-bulk-approve.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function dryRunBulkApprove() {
  const client = await pool.connect();

  console.log("═".repeat(70));
  console.log("BULK APPROVAL DRY RUN");
  console.log("═".repeat(70));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log("═".repeat(70));
  console.log("");

  try {
    // Get all pending mappings
    const pendingResult = await client.query(`
      SELECT 
        id,
        year,
        make,
        model,
        our_trim as trim,
        status,
        match_confidence as confidence,
        needs_review,
        has_single_config,
        review_reason,
        review_notes,
        default_wheel_diameter
      FROM wheel_size_trim_mappings
      WHERE status = 'pending'
      ORDER BY year DESC, make, model, our_trim
    `);

    const pendingMappings = pendingResult.rows;
    console.log(`Total pending mappings: ${pendingMappings.length}`);
    console.log("");

    // Check for duplicates
    const ymmTrimCount = {};
    for (const m of pendingMappings) {
      const key = `${m.year}|${m.make}|${m.model}|${m.trim}`;
      ymmTrimCount[key] = (ymmTrimCount[key] || 0) + 1;
    }

    const eligible = [];
    const excluded = [];
    const byReason = {};

    for (const mapping of pendingMappings) {
      const ymmKey = `${mapping.year}|${mapping.make}|${mapping.model}|${mapping.trim}`;
      let exclusionReason = null;

      // Eligibility criteria
      if (mapping.confidence !== 'high') {
        exclusionReason = 'CONFIDENCE_NOT_HIGH';
      } else if (!mapping.needs_review) {
        exclusionReason = 'NOT_MARKED_FOR_REVIEW';
      } else if (!mapping.has_single_config) {
        exclusionReason = 'NOT_SINGLE_CONFIG';
      } else if (mapping.review_reason?.includes('TRIM_TIRE_VARIANCE')) {
        exclusionReason = 'TRIM_TIRE_VARIANCE';
      } else if (mapping.review_notes && mapping.review_notes.trim() !== '') {
        exclusionReason = 'HAS_REVIEW_NOTES';
      } else if (ymmTrimCount[ymmKey] > 1) {
        exclusionReason = 'DUPLICATE_YMM_TRIM';
      } else if (mapping.review_reason && !mapping.review_reason.includes('Single-default batch')) {
        exclusionReason = 'NON_STANDARD_REVIEW_REASON';
      }

      if (exclusionReason) {
        excluded.push({
          ...mapping,
          exclusionReason,
        });
        byReason[exclusionReason] = (byReason[exclusionReason] || 0) + 1;
      } else {
        eligible.push(mapping);
      }
    }

    // Output results
    console.log("─".repeat(70));
    console.log("ELIGIBILITY RESULTS");
    console.log("─".repeat(70));
    console.log(`✅ Eligible for bulk approval: ${eligible.length}`);
    console.log(`❌ Excluded: ${excluded.length}`);
    console.log("");

    console.log("─".repeat(70));
    console.log("EXCLUSION REASONS BREAKDOWN");
    console.log("─".repeat(70));
    
    if (Object.keys(byReason).length === 0) {
      console.log("   No exclusions!");
    } else {
      for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${reason}: ${count}`);
      }
    }
    console.log("");

    // Show eligible by make
    const eligibleByMake = {};
    for (const m of eligible) {
      eligibleByMake[m.make] = (eligibleByMake[m.make] || 0) + 1;
    }

    console.log("─".repeat(70));
    console.log("ELIGIBLE BY MAKE (Top 15)");
    console.log("─".repeat(70));
    const sortedMakes = Object.entries(eligibleByMake).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [make, count] of sortedMakes) {
      console.log(`   ${make}: ${count}`);
    }
    console.log("");

    // Sample eligible
    console.log("─".repeat(70));
    console.log("SAMPLE ELIGIBLE (first 10)");
    console.log("─".repeat(70));
    for (const m of eligible.slice(0, 10)) {
      console.log(`   ${m.year} ${m.make} ${m.model} ${m.trim}`);
      console.log(`     → ${m.default_wheel_diameter}", confidence: ${m.confidence}`);
    }
    console.log("");

    // Sample excluded
    if (excluded.length > 0) {
      console.log("─".repeat(70));
      console.log("SAMPLE EXCLUDED (first 10)");
      console.log("─".repeat(70));
      for (const m of excluded.slice(0, 10)) {
        console.log(`   ${m.year} ${m.make} ${m.model} ${m.trim}`);
        console.log(`     ❌ Reason: ${m.exclusionReason}`);
      }
      console.log("");
    }

    console.log("═".repeat(70));
    console.log("DRY RUN COMPLETE - NO CHANGES MADE");
    console.log("═".repeat(70));
    console.log("");
    console.log(`Ready to approve ${eligible.length} high-confidence mappings.`);
    console.log("Use POST /api/admin/trim-mappings/bulk-approve with dryRun: false to execute.");

    return {
      totalPending: pendingMappings.length,
      eligible: eligible.length,
      excluded: excluded.length,
      byReason,
    };

  } finally {
    client.release();
    await pool.end();
  }
}

dryRunBulkApprove()
  .then(result => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch(err => {
    console.error("\n❌ ERROR:", err);
    process.exit(1);
  });
