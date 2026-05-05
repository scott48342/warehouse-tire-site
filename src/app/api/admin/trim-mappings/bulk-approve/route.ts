/**
 * Bulk Approve Trim Mappings API
 * 
 * POST /api/admin/trim-mappings/bulk-approve
 * 
 * SAFE: Only approves high-confidence, clean mappings.
 * Supports dry-run mode for preview.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { wheelSizeTrimMappings } from "@/lib/fitment-db/schema";
import { eq, and, sql, isNull, or } from "drizzle-orm";
import { randomUUID } from "crypto";

interface BulkApproveRequest {
  dryRun?: boolean;
  batchNote?: string;
  limit?: number;
}

interface EligibilityResult {
  eligible: Array<{
    id: string;
    year: number;
    make: string;
    model: string;
    trim: string;
    diameter: number | null;
    confidence: string;
  }>;
  excluded: Array<{
    id: string;
    year: number;
    make: string;
    model: string;
    trim: string;
    reason: string;
  }>;
  stats: {
    totalPending: number;
    eligible: number;
    excluded: number;
    byExclusionReason: Record<string, number>;
  };
}

/**
 * Check eligibility for bulk approval
 */
async function checkEligibility(): Promise<EligibilityResult> {
  // Get all pending mappings
  const pendingMappings = await db
    .select({
      id: wheelSizeTrimMappings.id,
      year: wheelSizeTrimMappings.year,
      make: wheelSizeTrimMappings.make,
      model: wheelSizeTrimMappings.model,
      trim: wheelSizeTrimMappings.ourTrim,
      status: wheelSizeTrimMappings.status,
      confidence: wheelSizeTrimMappings.matchConfidence,
      needsReview: wheelSizeTrimMappings.needsReview,
      hasSingleConfig: wheelSizeTrimMappings.hasSingleConfig,
      reviewReason: wheelSizeTrimMappings.reviewReason,
      reviewNotes: wheelSizeTrimMappings.reviewNotes,
      defaultWheelDiameter: wheelSizeTrimMappings.defaultWheelDiameter,
    })
    .from(wheelSizeTrimMappings)
    .where(eq(wheelSizeTrimMappings.status, "pending"));

  const eligible: EligibilityResult["eligible"] = [];
  const excluded: EligibilityResult["excluded"] = [];
  const byExclusionReason: Record<string, number> = {};

  // Check for duplicate YMM/trim combinations (conflict check)
  const ymmTrimCount: Record<string, number> = {};
  for (const m of pendingMappings) {
    const key = `${m.year}|${m.make}|${m.model}|${m.trim}`;
    ymmTrimCount[key] = (ymmTrimCount[key] || 0) + 1;
  }

  for (const mapping of pendingMappings) {
    const ymmKey = `${mapping.year}|${mapping.make}|${mapping.model}|${mapping.trim}`;
    let exclusionReason: string | null = null;

    // Check eligibility criteria
    if (mapping.confidence !== "high") {
      exclusionReason = "CONFIDENCE_NOT_HIGH";
    } else if (!mapping.needsReview) {
      exclusionReason = "NOT_MARKED_FOR_REVIEW";
    } else if (!mapping.hasSingleConfig) {
      exclusionReason = "NOT_SINGLE_CONFIG";
    } else if (mapping.reviewReason?.includes("TRIM_TIRE_VARIANCE")) {
      exclusionReason = "TRIM_TIRE_VARIANCE";
    } else if (mapping.reviewNotes && mapping.reviewNotes.trim() !== "") {
      exclusionReason = "HAS_REVIEW_NOTES";
    } else if (ymmTrimCount[ymmKey] > 1) {
      exclusionReason = "DUPLICATE_YMM_TRIM";
    } else if (mapping.reviewReason && !mapping.reviewReason.includes("Single-default batch")) {
      // Only allow standard batch import reasons
      exclusionReason = "NON_STANDARD_REVIEW_REASON";
    }

    if (exclusionReason) {
      excluded.push({
        id: mapping.id,
        year: mapping.year,
        make: mapping.make,
        model: mapping.model,
        trim: mapping.trim,
        reason: exclusionReason,
      });
      byExclusionReason[exclusionReason] = (byExclusionReason[exclusionReason] || 0) + 1;
    } else {
      eligible.push({
        id: mapping.id,
        year: mapping.year,
        make: mapping.make,
        model: mapping.model,
        trim: mapping.trim,
        diameter: mapping.defaultWheelDiameter,
        confidence: mapping.confidence || "unknown",
      });
    }
  }

  return {
    eligible,
    excluded,
    stats: {
      totalPending: pendingMappings.length,
      eligible: eligible.length,
      excluded: excluded.length,
      byExclusionReason,
    },
  };
}

/**
 * Execute bulk approval
 */
async function executeBulkApproval(
  eligibleIds: string[],
  batchNote: string
): Promise<{ approvedCount: number; batchId: string }> {
  const batchId = randomUUID();
  const approvedAt = new Date();
  const approvedBy = `bulk_approve_${batchId.slice(0, 8)}`;

  // Update all eligible mappings
  await db
    .update(wheelSizeTrimMappings)
    .set({
      status: "approved",
      needsReview: false,
      reviewedAt: approvedAt,
      reviewedBy: approvedBy,
      reviewNotes: `Bulk approved: ${batchNote || "High-confidence single-default mappings"} (batch: ${batchId})`,
      updatedAt: approvedAt,
    })
    .where(
      sql`${wheelSizeTrimMappings.id} IN (${sql.join(
        eligibleIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  return { approvedCount: eligibleIds.length, batchId };
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkApproveRequest = await request.json();
    const { dryRun = true, batchNote = "", limit } = body;

    // Check eligibility
    const eligibility = await checkEligibility();

    // Apply limit if specified
    let eligibleToApprove = eligibility.eligible;
    if (limit && limit > 0) {
      eligibleToApprove = eligibleToApprove.slice(0, limit);
    }

    if (dryRun) {
      // Dry run - just return preview
      return NextResponse.json({
        mode: "dry_run",
        eligibility: {
          ...eligibility.stats,
          limitApplied: limit || null,
          willApprove: eligibleToApprove.length,
        },
        preview: {
          eligible: eligibleToApprove.slice(0, 20), // First 20 for preview
          excluded: eligibility.excluded.slice(0, 20), // First 20 excluded
        },
        exclusionReasons: eligibility.stats.byExclusionReason,
        message: `Dry run complete. ${eligibleToApprove.length} mappings would be approved.`,
      });
    }

    // Live execution
    if (eligibleToApprove.length === 0) {
      return NextResponse.json({
        mode: "live",
        error: "No eligible mappings to approve",
        eligibility: eligibility.stats,
      }, { status: 400 });
    }

    const result = await executeBulkApproval(
      eligibleToApprove.map((m) => m.id),
      batchNote
    );

    return NextResponse.json({
      mode: "live",
      success: true,
      result: {
        approvedCount: result.approvedCount,
        batchId: result.batchId,
      },
      eligibility: eligibility.stats,
      message: `Successfully approved ${result.approvedCount} mappings. Batch ID: ${result.batchId}`,
    });
  } catch (error) {
    console.error("Bulk approve error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // GET returns eligibility preview only
    const eligibility = await checkEligibility();

    return NextResponse.json({
      eligibility: eligibility.stats,
      preview: {
        eligible: eligibility.eligible.slice(0, 10),
        excluded: eligibility.excluded.slice(0, 10),
      },
      exclusionReasons: eligibility.stats.byExclusionReason,
    });
  } catch (error) {
    console.error("Eligibility check error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
