/**
 * Public Fitment API - Trims
 * 
 * GET /api/public/fitment/trims?year=2020&make=ford&model=mustang
 * 
 * Returns available trims for a specific year/make/model.
 */

import { NextRequest, NextResponse } from "next/server";
import { withPublicApi, successResponse, errorResponse } from "@/lib/api/middleware";
import { getPublicTrims } from "@/lib/api/public-fitment-service";

export const runtime = "nodejs";

export const GET = withPublicApi(async (req: NextRequest) => {
  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  // Validate required params
  if (!yearParam || !make || !model) {
    return errorResponse(
      "year, make, and model parameters are required",
      400,
      "MISSING_PARAMS"
    );
  }

  const year = parseInt(yearParam, 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return errorResponse("Invalid year parameter", 400, "INVALID_YEAR");
  }

  try {
    const trims = await getPublicTrims(year, make, model);
    return successResponse(trims, { 
      count: trims.length,
      filter: { year, make, model },
    });
  } catch (error) {
    console.error("[PublicAPI/trims] Error:", error);
    return errorResponse("Failed to fetch trims", 500);
  }
});
