/**
 * GET /api/admin/validation/export
 * 
 * Export validation results as CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { exportResultsAsCsv } from "@/lib/fitment-db/validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");
    
    if (!runId) {
      return NextResponse.json(
        { success: false, error: "runId is required" },
        { status: 400 }
      );
    }
    
    const csv = await exportResultsAsCsv(runId);
    
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="validation-${runId}.csv"`,
      },
    });
  } catch (err: any) {
    console.error("[admin/validation/export] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
