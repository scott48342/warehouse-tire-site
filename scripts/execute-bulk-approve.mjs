/**
 * Execute Bulk Approval - LIVE
 * 
 * Approves all eligible high-confidence mappings.
 * 
 * Run: node scripts/execute-bulk-approve.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function executeBulkApprove() {
  const client = await pool.connect();

  console.log("═".repeat(70));
  console.log("BULK APPROVAL - LIVE EXECUTION");
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
        match_confidence as confidence,
        needs_review,
        has_single_config,
        review_reason,
        review_notes
      FROM wheel_size_trim_mappings
      WHERE status = 'pending'
      ORDER BY year DESC, make, model, our_trim
    `);

    const pendingMappings = pendingResult.rows;
    console.log(`Total pending mappings: ${pendingMappings.length}`);

    // Check for duplicates
    const ymmTrimCount = {};
    for (const m of pendingMappings) {
      const key = `${m.year}|${m.make}|${m.model}|${m.trim}`;
      ymmTrimCount[key] = (ymmTrimCount[key] || 0) + 1;
    }

    const eligible = [];
    const excluded = [];

    for (const mapping of pendingMappings) {
      const ymmKey = `${mapping.year}|${mapping.make}|${mapping.model}|${mapping.trim}`;
      let exclusionReason = null;

      // Strict eligibility criteria
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
        excluded.push({ ...mapping, exclusionReason });
      } else {
        eligible.push(mapping);
      }
    }

    console.log(`Eligible for approval: ${eligible.length}`);
    console.log(`Excluded: ${excluded.length}`);
    console.log("");

    if (eligible.length === 0) {
      console.log("❌ No eligible mappings to approve.");
      return;
    }

    // Generate batch ID
    const batchId = randomUUID();
    const approvedAt = new Date();
    const approvedBy = `bulk_approve_${batchId.slice(0, 8)}`;

    console.log("─".repeat(70));
    console.log("EXECUTING BULK APPROVAL");
    console.log("─".repeat(70));
    console.log(`Batch ID: ${batchId}`);
    console.log(`Approving ${eligible.length} mappings...`);
    console.log("");

    // Execute approval in batches of 100 for safety
    const eligibleIds = eligible.map(m => m.id);
    const batchSize = 100;
    let approvedCount = 0;

    for (let i = 0; i < eligibleIds.length; i += batchSize) {
      const batch = eligibleIds.slice(i, i + batchSize);
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(', ');
      
      await client.query(`
        UPDATE wheel_size_trim_mappings
        SET 
          status = 'approved',
          needs_review = false,
          reviewed_at = $${batch.length + 1},
          reviewed_by = $${batch.length + 2},
          review_notes = $${batch.length + 3},
          updated_at = $${batch.length + 4}
        WHERE id IN (${placeholders})
      `, [
        ...batch,
        approvedAt,
        approvedBy,
        `Bulk approved: High-confidence single-default mappings (batch: ${batchId})`,
        approvedAt,
      ]);

      approvedCount += batch.length;
      console.log(`  Approved batch ${Math.floor(i / batchSize) + 1}: ${batch.length} mappings (total: ${approvedCount})`);
    }

    console.log("");
    console.log("─".repeat(70));
    console.log("VERIFICATION");
    console.log("─".repeat(70));

    // Verify final counts
    const finalCounts = await client.query(`
      SELECT status, COUNT(*) as cnt
      FROM wheel_size_trim_mappings
      GROUP BY status
      ORDER BY status
    `);

    console.log("Final mapping counts by status:");
    for (const row of finalCounts.rows) {
      console.log(`   ${row.status}: ${row.cnt}`);
    }
    console.log("");

    // Verify excluded are still pending
    const excludedStillPending = await client.query(`
      SELECT COUNT(*) as cnt
      FROM wheel_size_trim_mappings
      WHERE status = 'pending'
      AND match_confidence != 'high'
    `);
    console.log(`Medium-confidence still pending: ${excludedStillPending.rows[0].cnt}`);

    console.log("");
    console.log("═".repeat(70));
    console.log("BULK APPROVAL COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log(`✅ Batch ID: ${batchId}`);
    console.log(`✅ Approved: ${approvedCount}`);
    console.log(`✅ Excluded: ${excluded.length}`);
    console.log("");
    console.log("Excluded vehicles (for reference):");
    for (const ex of excluded) {
      console.log(`   ❌ ${ex.year} ${ex.make} ${ex.model} ${ex.trim} - ${ex.exclusionReason}`);
    }

    return {
      batchId,
      approvedCount,
      excludedCount: excluded.length,
      excluded,
    };

  } finally {
    client.release();
    await pool.end();
  }
}

executeBulkApprove()
  .then(result => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch(err => {
    console.error("\n❌ ERROR:", err);
    process.exit(1);
  });
