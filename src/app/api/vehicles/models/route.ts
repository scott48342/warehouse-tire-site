/**
 * Vehicle Models API (Coverage-Validated + Cached)
 * 
 * GET /api/vehicles/models?make=Ford&year=2024
 * 
 * Returns ONLY models that have actual fitment data in the database.
 * Uses Redis cache to reduce DB load. Falls back to static data if DB unavailable.
 */

import { NextResponse } from "next/server";
import { getModelsWithCoverage } from "@/lib/fitment-db/coverage";
import { modelToDisplayName, getCanonicalModelKey } from "@/lib/fitment-db/keys";
import {
  getCachedModels,
  setCachedModels,
  getFallbackModels,
} from "@/lib/fitment-db/ymmCache";

export const runtime = "nodejs";

/**
 * GET /api/vehicles/models?make=Ford&year=2024
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;
  const noCache = url.searchParams.get("nocache") === "1";

  if (!make) {
    return NextResponse.json({ 
      results: [],
      source: "error",
      error: "make parameter is required",
    });
  }

  // 1. Check cache first (skip if nocache=1)
  if (!noCache) {
    try {
      const cached = await getCachedModels(make, year);
      if (cached && cached.length > 0) {
        console.log(`[models] CACHE HIT: ${cached.length} models for ${make} (year=${year || "all"})`);
        return NextResponse.json({
          results: cached,
          source: "cache",
          count: cached.length,
          yearFiltered: !!year,
        }, {
          headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
        });
      }
    } catch (e) {
      // Cache error - continue to DB
    }
  }

  // 2. Try DB
  try {
    const modelSlugs = await getModelsWithCoverage(make, year);
    
    if (modelSlugs.length === 0) {
      console.warn(`[models] NO COVERAGE: ${make}${year ? ` (${year})` : ""}`);
      
      // Try fallback
      const fallback = getFallbackModels(make);
      if (fallback.length > 0) {
        console.warn(`[models] FALLBACK: Serving ${fallback.length} static models for ${make}`);
        return NextResponse.json({
          results: fallback,
          source: "fallback",
          count: fallback.length,
          warning: `No verified fitment data for ${make}${year ? ` ${year}` : ""}`,
          yearFiltered: false,
        }, {
          headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
        });
      }
      
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
      if (displayName && !modelMap.has(key)) {
        modelMap.set(key, displayName);
      }
    }
    
    // Dedupe by display name and sort
    const results = [...new Set(Array.from(modelMap.values()))].sort();
    
    console.log(`[models] DB: ${results.length} models for ${make}${year ? ` (${year})` : ""}`);
    
    // Cache the result (fire and forget)
    setCachedModels(results, make, year).catch(() => {});
    
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
    
    // 3. Fallback to static data
    const fallback = getFallbackModels(make);
    if (fallback.length > 0) {
      console.warn(`[models] FALLBACK: Serving ${fallback.length} static models for ${make} due to DB error`);
      return NextResponse.json({
        results: fallback,
        source: "fallback",
        count: fallback.length,
        warning: "Using cached data - live data temporarily unavailable",
        yearFiltered: false,
      }, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    }
    
    return NextResponse.json({ 
      results: [],
      source: "error",
      error: "Failed to check fitment coverage",
    }, { status: 500 });
  }
}
