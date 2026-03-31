/**
 * GET /api/classic/fitment
 * 
 * Classic vehicle fitment lookup.
 * ISOLATED from modern fitment endpoints.
 * 
 * Query params:
 * - year: Vehicle year (required)
 * - make: Vehicle make (required)
 * - model: Vehicle model (required)
 */

import { NextResponse } from "next/server";
import {
  isClassicVehicle,
  getClassicFitment,
  type ClassicFitmentResponse,
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
    // Check if this is a classic vehicle
    const isClassic = isClassicVehicle(year, make);
    
    if (!isClassic) {
      return NextResponse.json({
        isClassicVehicle: false,
        fitmentMode: "not_classic",
        message: `${year} ${make} ${model} is not classified as a classic vehicle. Use /api/wheels/fitment-search for modern vehicles.`,
      });
    }

    // Look up classic fitment
    const result = await getClassicFitment(year, make, model);

    if (result.fitmentMode === "not_found") {
      return NextResponse.json(result, { status: 404 });
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
