/**
 * Vehicle Package Choices API
 * 
 * Returns customer-friendly package labels for multi-config trims.
 * Used by the frontend to replace generic size chooser with package labels.
 * 
 * GET /api/vehicles/package-choices?year=2024&make=Ram&model=1500&trim=Big+Horn
 */

import { NextRequest, NextResponse } from "next/server";
import { getPackageChoicesForVehicle } from "@/lib/fitment/oemPackageChoices";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    const yearStr = searchParams.get("year");
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const trim = searchParams.get("trim");

    if (!yearStr || !make || !model || !trim) {
      return NextResponse.json({
        success: false,
        error: "year, make, model, and trim parameters are required",
        available: false,
        choices: [],
      }, { status: 400 });
    }

    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      return NextResponse.json({
        success: false,
        error: "year must be a valid number",
        available: false,
        choices: [],
      }, { status: 400 });
    }

    const result = await getPackageChoicesForVehicle(year, make, model, trim);

    return NextResponse.json({
      success: true,
      ...result,
      vehicle: { year, make, model, trim },
    });
  } catch (error) {
    console.error("[api/vehicles/package-choices] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch package choices",
      available: false,
      choices: [],
    }, { status: 500 });
  }
}
