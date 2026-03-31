/**
 * Vehicle Search API (DB-Only)
 * 
 * GET /api/vehicles/search?year=2024&make=Ford&model=F-150&modification=xyz
 * 
 * Returns vehicle fitment data from the database.
 * No external API calls - all data comes from vehicle_fitments table.
 */

import { NextResponse } from "next/server";
import { getFitmentProfile } from "@/lib/fitment-db/profileService";

export const runtime = "nodejs";

/**
 * GET /api/vehicles/search?year=2024&make=Ford&model=F-150&modification=s_abc123
 * 
 * Returns vehicle fitment data (bolt pattern, tire sizes, wheel specs) from database.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  // PARAM SEPARATION: prefer modification, fall back to trim for backward compat
  const modificationParam = url.searchParams.get("modification") || "";
  const trimParam = url.searchParams.get("trim") || "";
  const modificationRaw = modificationParam || trimParam;
  
  if (!modificationParam && trimParam) {
    console.warn(`[vehicles/search] DEPRECATION: Using 'trim' param. Migrate to 'modification=${trimParam}'`);
  }
  
  // Handle composite modification values like "bfd36e8a76__xlt__"
  const modification = modificationRaw.includes("__") 
    ? modificationRaw.split("__")[0] 
    : modificationRaw;

  if (!year || !make || !model) {
    return NextResponse.json({
      fitment: null,
      error: "Missing required params: year, make, model",
    });
  }

  try {
    // Use the profile service which is now DB-only
    const result = await getFitmentProfile(
      parseInt(year, 10),
      make,
      model,
      modification || "base"
    );

    if (!result.profile) {
      return NextResponse.json({ 
        fitment: null, 
        error: "No fitment data found in database",
        resolutionPath: result.resolutionPath,
      });
    }

    // Convert to the expected fitment format
    const fitment = {
      boltPattern: result.profile.boltPattern,
      centerBore: result.profile.centerBoreMm?.toString() || null,
      tireSizes: result.profile.oemTireSizes,
      wheelDiameterRangeIn: result.profile.oemWheelSizes.length > 0
        ? [
            Math.min(...result.profile.oemWheelSizes.map(w => w.diameter)),
            Math.max(...result.profile.oemWheelSizes.map(w => w.diameter)),
          ]
        : null,
      wheelWidthRangeIn: result.profile.oemWheelSizes.length > 0
        ? [
            Math.min(...result.profile.oemWheelSizes.map(w => w.width)),
            Math.max(...result.profile.oemWheelSizes.map(w => w.width)),
          ]
        : null,
      offsetRangeMm: (result.profile.offsetMinMm !== null && result.profile.offsetMaxMm !== null)
        ? [result.profile.offsetMinMm, result.profile.offsetMaxMm]
        : null,
      modification: {
        slug: result.profile.modificationId,
        name: result.profile.displayTrim,
      },
    };

    return NextResponse.json({ 
      fitment,
      source: "database",
      resolutionPath: result.resolutionPath,
    });
  } catch (err: any) {
    console.error(`[vehicles/search] Error:`, err?.message || err);
    return NextResponse.json({ fitment: null, error: err?.message || "Unknown error" });
  }
}
