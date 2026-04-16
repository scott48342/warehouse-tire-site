/**
 * Vehicle Years API (Coverage-Validated + Cached)
 * 
 * GET /api/vehicles/years?make=Buick&model=Encore
 * 
 * Returns ONLY years that have actual fitment data in the database.
 * Uses Redis cache to reduce DB load. Falls back to static range if DB unavailable.
 */

import { NextResponse } from "next/server";
import { getYearsWithCoverage } from "@/lib/fitment-db/coverage";
import {
  getCachedYears,
  setCachedYears,
  getFallbackYears,
} from "@/lib/fitment-db/ymmCache";

export const runtime = "nodejs";

/**
 * GET /api/vehicles/years?make=Buick&model=Encore
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if (!make || !model) {
    return NextResponse.json({ 
      results: [],
      source: "error",
      error: "make and model parameters are required",
    });
  }

  // 1. Check cache first
  try {
    const cached = await getCachedYears(make, model);
    if (cached && cached.length > 0) {
      console.log(`[years] CACHE HIT: ${cached.length} years for ${make} ${model}`);
      return NextResponse.json({ 
        results: cached.map(String),
        source: "cache",
        count: cached.length,
      }, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
      });
    }
  } catch (e) {
    // Cache error - continue to DB
  }

  // 2. Try DB
  try {
    const coverage = await getYearsWithCoverage(make, model);
    
    if (coverage.years.length > 0) {
      console.log(`[years] DB: ${coverage.years.length} years for ${make} ${model}`);
      
      // Cache the result (fire and forget)
      setCachedYears(coverage.years, make, model).catch(() => {});
      
      return NextResponse.json({ 
        results: coverage.years.map(String),
        source: "fitment_db",
        count: coverage.years.length,
      }, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
      });
    }
    
    // No coverage - return empty (no fallback for specific model years)
    console.warn(`[years] NO COVERAGE: ${make} ${model}`);
    return NextResponse.json({ 
      results: [],
      source: "no_coverage",
      warning: `No fitment data available for ${make} ${model}`,
    });
    
  } catch (err: any) {
    console.error(`[years] DB error for ${make} ${model}:`, err?.message);
    
    // 3. Fallback to common year range
    const fallback = getFallbackYears();
    console.warn(`[years] FALLBACK: Serving ${fallback.length} year range due to DB error`);
    
    return NextResponse.json({ 
      results: fallback.map(String),
      source: "fallback",
      count: fallback.length,
      warning: "Using estimated year range - live data temporarily unavailable",
    }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  }
}
