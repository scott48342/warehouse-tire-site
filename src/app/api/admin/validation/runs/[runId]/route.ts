/**
 * GET /api/admin/validation/runs/[runId]
 * 
 * Get a single validation run with summary
 */

import { NextRequest, NextResponse } from "next/server";
import { getValidationRun, getFailureBreakdown } from "@/lib/fitment-db/validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    const run = await getValidationRun(runId);
    
    if (!run) {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }
    
    // Get failure breakdown
    const failureBreakdown = await getFailureBreakdown(runId);
    
    return NextResponse.json({
      success: true,
      run,
      failureBreakdown,
    });
  } catch (err: any) {
    console.error("[admin/validation/runs/[runId]] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
