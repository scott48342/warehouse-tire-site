/**
 * Public Fitment API - Specs
 * 
 * GET /api/public/fitment/specs?year=2020&make=ford&model=mustang&trim=gt
 * 
 * Returns full fitment specifications for a specific vehicle trim.
 * Includes bolt pattern, center bore, wheel sizes, tire sizes, staggered flag.
 */

import { NextRequest, NextResponse } from "next/server";
import { withPublicApi, successResponse, errorResponse } from "@/lib/api/middleware";
import { getPublicSpecs } from "@/lib/api/public-fitment-service";

export const runtime = "nodejs";

export const GET = withPublicApi(async (req: NextRequest) => {
  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const trimId = url.searchParams.get("trim") || url.searchParams.get("trimId");

  // Validate required params
  if (!yearParam || !make || !model || !trimId) {
    return errorResponse(
      "year, make, model, and trim parameters are required",
      400,
      "MISSING_PARAMS"
    );
  }

  const year = parseInt(yearParam, 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return errorResponse("Invalid year parameter", 400, "INVALID_YEAR");
  }

  try {
    const specs = await getPublicSpecs(year, make, model, trimId);
    
    if (!specs) {
      return errorResponse(
        `No fitment data found for ${year} ${make} ${model} ${trimId}`,
        404,
        "NOT_FOUND"
      );
    }

    return successResponse(specs, {
      filter: { year, make, model, trim: trimId },
    });
  } catch (error) {
    console.error("[PublicAPI/specs] Error:", error);
    return errorResponse("Failed to fetch specs", 500);
  }
});
