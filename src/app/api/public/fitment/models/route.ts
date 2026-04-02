/**
 * Public Fitment API - Models
 * 
 * GET /api/public/fitment/models?make=ford
 * GET /api/public/fitment/models?make=ford&year=2020
 * 
 * Returns models for a make. Optionally filtered by year.
 */

import { NextRequest, NextResponse } from "next/server";
import { withPublicApi, successResponse, errorResponse } from "@/lib/api/middleware";
import { getPublicModels } from "@/lib/api/public-fitment-service";

export const runtime = "nodejs";

export const GET = withPublicApi(async (req: NextRequest) => {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  // Require make
  if (!make) {
    return errorResponse("make parameter is required", 400, "MISSING_MAKE");
  }

  // Validate year if provided
  if (yearParam && (isNaN(year!) || year! < 1900 || year! > 2100)) {
    return errorResponse("Invalid year parameter", 400, "INVALID_YEAR");
  }

  try {
    const models = await getPublicModels(make, year);
    return successResponse(models, { 
      count: models.length,
      filter: { make, ...(year && { year }) },
    });
  } catch (error) {
    console.error("[PublicAPI/models] Error:", error);
    return errorResponse("Failed to fetch models", 500);
  }
});
