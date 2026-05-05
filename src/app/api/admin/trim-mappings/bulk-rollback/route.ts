/**
 * Bulk Rollback Trim Mappings API
 * 
 * POST /api/admin/trim-mappings/bulk-rollback
 * 
 * Reverts a bulk approval batch back to pending status.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { wheelSizeTrimMappings } from "@/lib/fitment-db/schema";
import { sql, like } from "drizzle-orm";

interface RollbackRequest {
  batchId: string;
  dryRun?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: RollbackRequest = await request.json();
    const { batchId, dryRun = true } = body;

    if (!batchId) {
      return NextResponse.json(
        { error: "batchId is required" },
        { status: 400 }
      );
    }

    // Find mappings that were approved in this batch
    const affectedMappings = await db
      .select({
        id: wheelSizeTrimMappings.id,
        year: wheelSizeTrimMappings.year,
        make: wheelSizeTrimMappings.make,
        model: wheelSizeTrimMappings.model,
        trim: wheelSizeTrimMappings.ourTrim,
        reviewNotes: wheelSizeTrimMappings.reviewNotes,
      })
      .from(wheelSizeTrimMappings)
      .where(like(wheelSizeTrimMappings.reviewNotes, `%batch: ${batchId}%`));

    if (affectedMappings.length === 0) {
      return NextResponse.json({
        mode: dryRun ? "dry_run" : "live",
        error: "No mappings found for this batch ID",
        batchId,
      }, { status: 404 });
    }

    if (dryRun) {
      return NextResponse.json({
        mode: "dry_run",
        batchId,
        affectedCount: affectedMappings.length,
        preview: affectedMappings.slice(0, 20),
        message: `Dry run: ${affectedMappings.length} mappings would be rolled back to pending.`,
      });
    }

    // Execute rollback
    const rollbackTime = new Date();
    await db
      .update(wheelSizeTrimMappings)
      .set({
        status: "pending",
        needsReview: true,
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes: sql`${wheelSizeTrimMappings.reviewNotes} || ' [ROLLED BACK at ${rollbackTime.toISOString()}]'`,
        updatedAt: rollbackTime,
      })
      .where(like(wheelSizeTrimMappings.reviewNotes, `%batch: ${batchId}%`));

    return NextResponse.json({
      mode: "live",
      success: true,
      batchId,
      rolledBackCount: affectedMappings.length,
      message: `Successfully rolled back ${affectedMappings.length} mappings to pending status.`,
    });
  } catch (error) {
    console.error("Rollback error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // List recent bulk approval batches
    const recentBatches = await db
      .select({
        reviewNotes: wheelSizeTrimMappings.reviewNotes,
        reviewedAt: wheelSizeTrimMappings.reviewedAt,
      })
      .from(wheelSizeTrimMappings)
      .where(like(wheelSizeTrimMappings.reviewNotes, "%Bulk approved%"))
      .limit(100);

    // Extract unique batch IDs
    const batchMap = new Map<string, { batchId: string; count: number; approvedAt: Date | null }>();
    
    for (const row of recentBatches) {
      const match = row.reviewNotes?.match(/batch: ([a-f0-9-]+)/);
      if (match) {
        const batchId = match[1];
        const existing = batchMap.get(batchId);
        if (existing) {
          existing.count++;
        } else {
          batchMap.set(batchId, {
            batchId,
            count: 1,
            approvedAt: row.reviewedAt,
          });
        }
      }
    }

    const batches = Array.from(batchMap.values()).sort((a, b) => {
      if (!a.approvedAt) return 1;
      if (!b.approvedAt) return -1;
      return b.approvedAt.getTime() - a.approvedAt.getTime();
    });

    return NextResponse.json({
      recentBatches: batches.slice(0, 10),
      message: "Use POST with batchId to rollback a specific batch",
    });
  } catch (error) {
    console.error("List batches error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
