/**
 * Vehicle Years API (Coverage-Validated)
 * 
 * GET /api/vehicles/years?make=Buick&model=Encore
 * 
 * Returns ONLY years that have actual fitment data in the database.
 * No fallback to static ranges - if no coverage exists, returns empty.
 */

import { NextResponse } from "next/server";
import { getYearsWithCoverage } from "@/lib/fitment-db/coverage";

export const runtime = "nodejs";

/**
 * GET /api/vehicles/years?make=Buick&model=Encore
 * 
 * Returns years with actual fitment coverage. No static fallback.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  // Require make and model
  if (!make || !model) {
    return NextResponse.json({ 
      results: [],
      source: "error",
      error: "make and model parameters are required",
    });
  }

  try {
    // Get years with actual fitment coverage
    const coverage = await getYearsWithCoverage(make, model);
    
    if (coverage.years.length > 0) {
      console.log(`[years] COVERAGE: ${make} ${model} → ${coverage.years.length} years with fitment data`);
      return NextResponse.json({ 
        results: coverage.years.map(String),
        source: "fitment_db",
        count: coverage.years.length,
      }, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
      });
    }
    
    // No coverage - return empty
    console.warn(`[years] NO COVERAGE: ${make} ${model} has no fitment data`);
    return NextResponse.json({ 
      results: [],
      source: "no_coverage",
      warning: `No fitment data available for ${make} ${model}`,
    });
    
  } catch (err: any) {
    console.error(`[years] DB error for ${make} ${model}:`, err?.message);
    return NextResponse.json({ 
      results: [],
      source: "error",
      error: "Failed to check fitment coverage",
    }, { status: 500 });
  }
}
