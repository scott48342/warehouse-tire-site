/**
 * POST /api/admin/validation/rerun
 * 
 * Rerun failed vehicles from a previous run
 */

import { NextRequest, NextResponse } from "next/server";
import { rerunFailedVehicles } from "@/lib/fitment-db/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.runId) {
      return NextResponse.json(
        { success: false, error: "runId is required" },
        { status: 400 }
      );
    }
    
    console.log("[admin/validation/rerun] Rerunning failed vehicles from run:", body.runId);
    
    const newRunId = await rerunFailedVehicles(body.runId, body.createdBy || "admin");
    
    return NextResponse.json({
      success: true,
      runId: newRunId,
      message: "Rerun started",
    });
  } catch (err: any) {
    console.error("[admin/validation/rerun] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
