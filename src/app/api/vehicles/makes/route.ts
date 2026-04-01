/**
 * Vehicle Makes API (Coverage-Validated)
 * 
 * GET /api/vehicles/makes?year=2005
 * 
 * Returns ONLY makes that have actual fitment data in the database.
 * Year parameter filters to makes that have fitment data for that specific year.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { sql, eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Normalize make slug to display name
 */
function slugToDisplayName(slug: string): string {
  // Special cases
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
  
  // Default: capitalize each word
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * GET /api/vehicles/makes?year=2005
 * 
 * Returns makes with actual fitment coverage. No static fallback.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : null;

  try {
    let makes: string[];
    
    if (year && !isNaN(year)) {
      // Get makes with fitment data for this specific year
      const results = await db
        .selectDistinct({ make: vehicleFitments.make })
        .from(vehicleFitments)
        .where(eq(vehicleFitments.year, year))
        .orderBy(vehicleFitments.make);
      
      makes = results.map(r => slugToDisplayName(r.make));
      console.log(`[makes] COVERAGE (year ${year}): ${makes.length} makes with fitment data`);
    } else {
      // Get all makes with any fitment data
      const results = await db
        .selectDistinct({ make: vehicleFitments.make })
        .from(vehicleFitments)
        .orderBy(vehicleFitments.make);
      
      makes = results.map(r => slugToDisplayName(r.make));
      console.log(`[makes] COVERAGE (all): ${makes.length} makes with fitment data`);
    }
    
    // Sort and dedupe
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
    return NextResponse.json({
      results: [],
      source: "error",
      error: "Failed to check fitment coverage",
    }, { status: 500 });
  }
}
