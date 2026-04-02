/**
 * Public Fitment API - Years
 * 
 * GET /api/public/fitment/years
 * GET /api/public/fitment/years?make=ford&model=mustang
 * 
 * Returns available years. If make/model provided, filters to that vehicle.
 */

import { NextRequest, NextResponse } from "next/server";
import { withPublicApi, successResponse, errorResponse } from "@/lib/api/middleware";
import { getPublicYears, getPublicYearsForModel } from "@/lib/api/public-fitment-service";

export const runtime = "nodejs";

export const GET = withPublicApi(async (req: NextRequest) => {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  try {
    // If make and model provided, get years for that specific vehicle
    if (make && model) {
      const years = await getPublicYearsForModel(make, model);
      return successResponse(years, { 
        count: years.length,
        filter: { make, model },
      });
    }

    // Otherwise return all years
    const years = await getPublicYears();
    return successResponse(years, { count: years.length });
  } catch (error) {
    console.error("[PublicAPI/years] Error:", error);
    return errorResponse("Failed to fetch years", 500);
  }
});
