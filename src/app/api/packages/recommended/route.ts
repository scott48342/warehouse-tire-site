/**
 * API: GET /api/packages/recommended
 * 
 * Returns recommended wheel + tire packages for a vehicle.
 * 
 * Query params:
 * - year (required): Vehicle year
 * - make (required): Vehicle make
 * - model (required): Vehicle model
 * - trim (optional): Vehicle trim/modification
 * 
 * Returns:
 * - packages: Array of RecommendedPackage
 * - vehicle: Vehicle info
 * - fitment: Fitment data used
 * - timing: Performance metrics
 */

import { NextResponse } from "next/server";
import { getRecommendedPackages } from "@/lib/packages/engine";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const t0 = Date.now();
  
  try {
    const url = new URL(req.url);
    
    const yearStr = url.searchParams.get("year");
    const make = url.searchParams.get("make");
    const model = url.searchParams.get("model");
    const trim = url.searchParams.get("trim") || undefined;
    
    // Validation
    if (!yearStr || !make || !model) {
      return NextResponse.json(
        { error: "Missing required params: year, make, model" },
        { status: 400 }
      );
    }
    
    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 1990 || year > 2030) {
      return NextResponse.json(
        { error: "Invalid year" },
        { status: 400 }
      );
    }
    
    // Get packages
    const result = await getRecommendedPackages({
      year,
      make,
      model,
      trim,
    });
    
    return NextResponse.json({
      ...result,
      timing: {
        ...result.timing,
        apiTotalMs: Date.now() - t0,
      },
    });
    
  } catch (err: any) {
    console.error("[api/packages/recommended] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate packages", packages: [] },
      { status: 500 }
    );
  }
}
