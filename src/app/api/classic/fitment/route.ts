/**
 * GET /api/classic/fitment
 * 
 * Classic/Legacy vehicle fitment lookup (1990-1999 + pre-1985).
 * DATA-DRIVEN: Only returns classic fitment if data exists for the vehicle.
 * ISOLATED from modern fitment endpoints.
 * 
 * Query params:
 * - year: Vehicle year (required)
 * - make: Vehicle make (required)
 * - model: Vehicle model (required)
 * 
 * Returns:
 * - If classic data exists: full platform/fitment info
 * - If no data: { isClassicVehicle: false, fitmentMode: "not_found" }
 *   (caller should fall back to modern fitment system)
 */

import { NextResponse } from "next/server";
import {
  getClassicFitment,
} from "@/lib/classic-fitment";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  
  const yearParam = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  // Validate required params
  if (!yearParam || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  const year = parseInt(yearParam, 10);
  if (isNaN(year)) {
    return NextResponse.json(
      { error: "Invalid year" },
      { status: 400 }
    );
  }

  try {
    // DATA-DRIVEN detection: try to get classic fitment
    // If data exists → return it
    // If no data → return "not_found" (caller falls back to modern)
    const result = await getClassicFitment(year, make, model);

    if (result.fitmentMode === "not_found") {
      // No classic data for this vehicle - caller should use modern fitment
      return NextResponse.json({
        isClassicVehicle: false,
        fitmentMode: "not_found",
        message: `No classic fitment data for ${year} ${make} ${model}. Use modern fitment system.`,
        fallbackTo: "modern",
      });
    }

    // Success - return classic fitment data
    return NextResponse.json(result);

  } catch (err: any) {
    console.error("[classic/fitment] Error:", err?.message);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}
