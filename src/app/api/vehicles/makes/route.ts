/**
 * Vehicle Makes API (Coverage-Validated + Cached)
 * 
 * GET /api/vehicles/makes?year=2005
 * 
 * Returns ONLY makes that have actual fitment data in the database.
 * Uses Redis cache to reduce DB load. Falls back to static data if DB unavailable.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";
import {
  getCachedMakes,
  setCachedMakes,
  getFallbackMakes,
} from "@/lib/fitment-db/ymmCache";

export const runtime = "nodejs";

/**
 * Normalize make slug to display name
 */
function slugToDisplayName(slug: string): string {
  const specialCases: Record<string, string> = {
    "mercedes": "Mercedes-Benz",
    "mercedes-benz": "Mercedes-Benz",
    "land-rover": "Land Rover",
    "alfa-romeo": "Alfa Romeo",
    "aston-martin": "Aston Martin",
    "rolls-royce": "Rolls-Royce",
    "gmc": "GMC",
    "bmw": "BMW",
    "amg": "AMG",
    "amc": "AMC",
  };
  
  if (specialCases[slug.toLowerCase()]) {
    return specialCases[slug.toLowerCase()];
  }
  
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * GET /api/vehicles/makes?year=2005
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  const noCache = url.searchParams.get("nocache") === "1";

  // 1. Check cache first (skip if nocache=1)
  if (!noCache) {
    try {
      const cached = await getCachedMakes(year);
      if (cached && cached.length > 0) {
        console.log(`[makes] CACHE HIT: ${cached.length} makes (year=${year || "all"})`);
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
    let makes: string[];
    
    if (year && !isNaN(year)) {
      const results = await db
        .selectDistinct({ make: vehicleFitments.make })
        .from(vehicleFitments)
        .where(eq(vehicleFitments.year, year))
        .orderBy(vehicleFitments.make);
      
      makes = results.map(r => slugToDisplayName(r.make));
      console.log(`[makes] DB: ${makes.length} makes for year ${year}`);
    } else {
      const results = await db
        .selectDistinct({ make: vehicleFitments.make })
        .from(vehicleFitments)
        .orderBy(vehicleFitments.make);
      
      makes = results.map(r => slugToDisplayName(r.make));
      console.log(`[makes] DB: ${makes.length} makes (all years)`);
    }
    
    // Dedupe and sort
    const uniqueMakes = [...new Set(makes)].sort();
    
    if (uniqueMakes.length === 0) {
      return NextResponse.json({
        results: [],
        source: "no_coverage",
        warning: year 
          ? `No fitment data available for year ${year}`
          : "No fitment data available",
      });
    }
    
    // Cache the result (fire and forget)
    setCachedMakes(uniqueMakes, year).catch(() => {});
    
    return NextResponse.json({
      results: uniqueMakes,
      source: "fitment_db",
      count: uniqueMakes.length,
      yearFiltered: !!year,
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
    
  } catch (err: any) {
    console.error(`[makes] DB error:`, err?.message);
    
    // 3. Fallback to static data
    const fallback = getFallbackMakes();
    console.warn(`[makes] FALLBACK: Serving ${fallback.length} static makes due to DB error`);
    
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
}
