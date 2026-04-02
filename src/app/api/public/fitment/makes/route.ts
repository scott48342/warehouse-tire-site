/**
 * Public Fitment API - Makes
 * 
 * GET /api/public/fitment/makes
 * GET /api/public/fitment/makes?year=2020
 * 
 * Returns available makes. Optionally filtered by year.
 */

import { NextRequest, NextResponse } from "next/server";
import { withPublicApi, successResponse, errorResponse } from "@/lib/api/middleware";
import { getPublicMakes } from "@/lib/api/public-fitment-service";

export const runtime = "nodejs";

export const GET = withPublicApi(async (req: NextRequest) => {
  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  // Validate year if provided
  if (yearParam && (isNaN(year!) || year! < 1900 || year! > 2100)) {
    return errorResponse("Invalid year parameter", 400, "INVALID_YEAR");
  }

  try {
    const makes = await getPublicMakes(year);
    return successResponse(makes, { 
      count: makes.length,
      ...(year && { filter: { year } }),
    });
  } catch (error) {
    console.error("[PublicAPI/makes] Error:", error);
    return errorResponse("Failed to fetch makes", 500);
  }
});
