/**
 * GET /api/admin/validation/results
 * 
 * Get validation results with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { getValidationResults } from "@/lib/fitment-db/validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const options = {
      runId: searchParams.get("runId") || undefined,
      status: searchParams.get("status") || undefined,
      failureType: searchParams.get("failureType") || undefined,
      make: searchParams.get("make") || undefined,
      model: searchParams.get("model") || undefined,
      limit: parseInt(searchParams.get("limit") || "50", 10),
      offset: parseInt(searchParams.get("offset") || "0", 10),
    };
    
    const { results, total } = await getValidationResults(options);
    
    return NextResponse.json({
      success: true,
      results,
      total,
      limit: options.limit,
      offset: options.offset,
      hasMore: options.offset + results.length < total,
    });
  } catch (err: any) {
    console.error("[admin/validation/results] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
