/**
 * GET /api/admin/validation/runs
 * 
 * List all validation runs
 */

import { NextRequest, NextResponse } from "next/server";
import { getValidationRuns } from "@/lib/fitment-db/validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    
    const runs = await getValidationRuns({ status, limit });
    
    return NextResponse.json({
      success: true,
      runs,
      count: runs.length,
    });
  } catch (err: any) {
    console.error("[admin/validation/runs] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
