/**
 * POST /api/admin/validation/run
 * 
 * Start a new validation run
 */

import { NextRequest, NextResponse } from "next/server";
import { runValidation, type ValidationRunConfig } from "@/lib/fitment-db/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const config: ValidationRunConfig = {
      name: body.name || `Validation Run ${new Date().toISOString()}`,
      description: body.description,
      filterYear: body.year ? parseInt(body.year, 10) : undefined,
      filterMake: body.make,
      filterModel: body.model,
      filterBoltPattern: body.boltPattern,
      includeLifted: body.includeLifted !== false,
      limit: body.limit || 100,
      createdBy: body.createdBy || "admin",
    };
    
    console.log("[admin/validation/run] Starting validation run:", config);
    
    const runId = await runValidation(config);
    
    return NextResponse.json({
      success: true,
      runId,
      message: "Validation run started",
    });
  } catch (err: any) {
    console.error("[admin/validation/run] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
