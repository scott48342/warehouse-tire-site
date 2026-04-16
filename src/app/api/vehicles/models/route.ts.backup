/**
 * Vehicle Models API (Coverage-Validated)
 * 
 * GET /api/vehicles/models?make=Ford&year=2024
 * 
 * Returns ONLY models that have actual fitment data in the database.
 * Year parameter filters to models that have fitment data for that specific year.
 */

import { NextResponse } from "next/server";
import { getModelsWithCoverage } from "@/lib/fitment-db/coverage";
import { normalizeMake, modelToDisplayName, getCanonicalModelKey } from "@/lib/fitment-db/keys";

export const runtime = "nodejs";

/**
 * GET /api/vehicles/models?make=Ford&year=2024
 * 
 * Returns models with actual fitment coverage. No static fallback.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  if (!make) {
    return NextResponse.json({ 
      results: [],
      source: "error",
      error: "make parameter is required",
    });
  }

  try {
    // Get models with actual fitment coverage
    const modelSlugs = await getModelsWithCoverage(make, year);
    
    if (modelSlugs.length === 0) {
      console.warn(`[models] NO COVERAGE: ${make}${year ? ` (${year})` : ""} has no fitment data`);
      return NextResponse.json({ 
        results: [],
        source: "no_coverage",
        warning: `No fitment data available for ${make}${year ? ` ${year}` : ""}`,
      });
    }
    
    // Convert slugs to display names, deduped by canonical key
    const modelMap = new Map<string, string>();
    for (const slug of modelSlugs) {
      const key = getCanonicalModelKey(slug);
      const displayName = modelToDisplayName(slug);
      // Skip null display names (suppressed) and don't override existing
      if (displayName && !modelMap.has(key)) {
        modelMap.set(key, displayName);
      }
    }
    
    // Dedupe by display name and sort
    const results = [...new Set(Array.from(modelMap.values()))].sort();
    
    console.log(`[models] COVERAGE: ${make}${year ? ` (${year})` : ""} → ${results.length} models with fitment data`);
    
    return NextResponse.json({ 
      results,
      source: "fitment_db",
      count: results.length,
      yearFiltered: !!year,
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
    
  } catch (err: any) {
    console.error(`[models] DB error for ${make}:`, err?.message);
    return NextResponse.json({ 
      results: [],
      source: "error",
      error: "Failed to check fitment coverage",
    }, { status: 500 });
  }
}
