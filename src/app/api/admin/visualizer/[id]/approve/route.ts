/**
 * Approve/Reject Visualizer Config API
 * 
 * POST - Approve or reject a draft
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb, schema } from "@/lib/visualizer/db";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { 
      action,      // 'approve' | 'reject'
      reviewedBy,
      reviewNotes,
      setActive,   // optionally activate on approval
    } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get current config
    const current = await visualizerDb
      .select()
      .from(schema.visualizerConfigs)
      .where(eq(schema.visualizerConfigs.id, id))
      .limit(1);

    if (current.length === 0) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const config = current[0];

    if (action === "approve") {
      const updated = await visualizerDb
        .update(schema.visualizerConfigs)
        .set({
          status: "approved",
          isActive: setActive ?? true,
          reviewedBy: reviewedBy || null,
          reviewNotes: reviewNotes || config.reviewNotes,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.visualizerConfigs.id, id))
        .returning();

      return NextResponse.json({ 
        success: true, 
        action: "approved",
        config: updated[0],
      });
    } else {
      // Reject
      const updated = await visualizerDb
        .update(schema.visualizerConfigs)
        .set({
          status: "rejected",
          isActive: false,
          reviewedBy: reviewedBy || null,
          reviewNotes: reviewNotes || config.reviewNotes,
          updatedAt: new Date(),
        })
        .where(eq(schema.visualizerConfigs.id, id))
        .returning();

      return NextResponse.json({ 
        success: true, 
        action: "rejected",
        config: updated[0],
      });
    }
  } catch (error) {
    console.error("Approve/reject error:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
