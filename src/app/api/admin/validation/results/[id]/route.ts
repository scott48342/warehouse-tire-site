/**
 * GET /api/admin/validation/results/[id]
 * 
 * Get a single validation result with full diagnostics
 */

import { NextRequest, NextResponse } from "next/server";
import { getValidationResult } from "@/lib/fitment-db/validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await getValidationResult(id);
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: "Result not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error("[admin/validation/results/[id]] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
