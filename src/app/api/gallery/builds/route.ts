/**
 * Build Gallery Match API
 * 
 * Returns relevant real-vehicle build images from the WheelPros Canto gallery
 * based on vehicle type and build style (lifted/leveled/stock).
 * 
 * Used on wheels SRP to inspire confidence after build-type selection.
 * 
 * Matching priority:
 * 1. Same vehicle type + same lift level
 * 2. Same vehicle type + any lifted build
 * 3. Same vehicle type + any build
 * 4. Any lifted build (fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";

interface GalleryAsset {
  id: number;
  source_album_name: string;
  thumbnail_url: string;
  source_url: string;
  wheel_brand: string;
  wheel_model: string;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_trim: string | null;
  vehicle_type: string | null;
  lift_level: string | null;
  build_style: string | null;
  parse_confidence: string;
}

interface BuildMatch {
  id: number;
  albumName: string;
  thumbnailUrl: string;
  fullImageUrl: string;
  wheelBrand: string;
  wheelModel: string;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  vehicleType: string | null;
  liftLevel: string | null;
  buildStyle: string | null;
  matchLevel: "exact_lift" | "same_type_lifted" | "same_type" | "any_lifted" | "fallback";
}

// Infer vehicle type from make/model
function inferVehicleType(make?: string, model?: string): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  
  // Trucks
  if (m.includes("f-150") || m.includes("f150") || m.includes("f-250") || m.includes("f-350") ||
      m.includes("silverado") || m.includes("sierra") ||
      m.includes("ram") || m.includes("1500") || m.includes("2500") || m.includes("3500") ||
      m.includes("tundra") || m.includes("tacoma") || m.includes("ranger") ||
      m.includes("colorado") || m.includes("gladiator") ||
      m.includes("titan") || m.includes("frontier")) {
    return "truck";
  }
  
  // Jeeps
  if (make?.toLowerCase() === "jeep" || m.includes("wrangler") || m.includes("rubicon")) {
    return "jeep";
  }
  
  // SUVs
  if (m.includes("bronco") || m.includes("4runner") ||
      m.includes("tahoe") || m.includes("suburban") ||
      m.includes("yukon") || m.includes("escalade") ||
      m.includes("sequoia") || m.includes("land cruiser") ||
      m.includes("gx") || m.includes("expedition") ||
      m.includes("durango") || m.includes("armada")) {
    return "suv";
  }
  
  return null;
}

// Normalize build type to match our data
function normalizeBuildType(buildType?: string, liftedInches?: number): { isLifted: boolean; liftRange: string | null } {
  if (!buildType) return { isLifted: false, liftRange: null };
  
  const bt = buildType.toLowerCase();
  
  if (bt === "stock" || bt === "oem") {
    return { isLifted: false, liftRange: null };
  }
  
  if (bt === "leveled" || bt === "level") {
    return { isLifted: true, liftRange: "1-2" };
  }
  
  if (bt === "lifted" || bt.includes("lift")) {
    // Map lift inches to ranges
    if (liftedInches) {
      if (liftedInches <= 2) return { isLifted: true, liftRange: "1-2" };
      if (liftedInches <= 4) return { isLifted: true, liftRange: "3-4" };
      if (liftedInches <= 6) return { isLifted: true, liftRange: "5-6" };
      return { isLifted: true, liftRange: "6+" };
    }
    return { isLifted: true, liftRange: null };
  }
  
  return { isLifted: false, liftRange: null };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const vehicleType = searchParams.get("vehicleType") || "";
  const vehicleMake = searchParams.get("make") || "";
  const vehicleModel = searchParams.get("model") || "";
  const buildType = searchParams.get("buildType") || searchParams.get("liftedPreset") || "";
  const liftedInches = parseInt(searchParams.get("liftedInches") || "0", 10) || 0;
  const limit = Math.min(parseInt(searchParams.get("limit") || "6", 10), 10);
  
  // Infer vehicle type if not provided
  const effectiveVehicleType = vehicleType || inferVehicleType(vehicleMake, vehicleModel);
  const { isLifted, liftRange } = normalizeBuildType(buildType, liftedInches);
  
  // Don't show gallery for stock builds (no build inspiration needed)
  if (!isLifted) {
    return NextResponse.json({
      results: [],
      matchQuality: "none",
      reason: "Stock build - no gallery shown",
    });
  }
  
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({
      results: [],
      matchQuality: "error",
      error: "Database not configured"
    }, { status: 500 });
  }
  
  const results: BuildMatch[] = [];
  const seenIds = new Set<number>();
  
  try {
    // Level 1: Same vehicle type + matching lift range (if we have lift data)
    if (effectiveVehicleType && liftRange) {
      const exactLiftQuery = `
        SELECT * FROM gallery_assets
        WHERE vehicle_type = $1
          AND lift_level = $2
          AND thumbnail_url IS NOT NULL
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
          RANDOM()
        LIMIT $3
      `;
      const exactLiftResult = await pool.query<GalleryAsset>(exactLiftQuery, [
        effectiveVehicleType,
        liftRange,
        limit
      ]);
      
      for (const row of exactLiftResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "exact_lift"));
        }
      }
    }
    
    // Level 2: Same vehicle type + any lifted build (lift_level not null)
    if (results.length < limit && effectiveVehicleType) {
      const sameTypeLiftedQuery = `
        SELECT * FROM gallery_assets
        WHERE vehicle_type = $1
          AND lift_level IS NOT NULL
          AND thumbnail_url IS NOT NULL
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
          RANDOM()
        LIMIT $2
      `;
      const sameTypeLiftedResult = await pool.query<GalleryAsset>(sameTypeLiftedQuery, [
        effectiveVehicleType,
        limit - results.length
      ]);
      
      for (const row of sameTypeLiftedResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "same_type_lifted"));
        }
      }
    }
    
    // Level 3: Same vehicle type + any build (for leveled/mild lift looks)
    if (results.length < limit && effectiveVehicleType) {
      const sameTypeQuery = `
        SELECT * FROM gallery_assets
        WHERE vehicle_type = $1
          AND thumbnail_url IS NOT NULL
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
          RANDOM()
        LIMIT $2
      `;
      const sameTypeResult = await pool.query<GalleryAsset>(sameTypeQuery, [
        effectiveVehicleType,
        limit - results.length
      ]);
      
      for (const row of sameTypeResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "same_type"));
        }
      }
    }
    
    // Level 4: Any lifted build (generic inspiration)
    if (results.length < limit) {
      const anyLiftedQuery = `
        SELECT * FROM gallery_assets
        WHERE lift_level IS NOT NULL
          AND thumbnail_url IS NOT NULL
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
          RANDOM()
        LIMIT $1
      `;
      const anyLiftedResult = await pool.query<GalleryAsset>(anyLiftedQuery, [
        limit - results.length
      ]);
      
      for (const row of anyLiftedResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "any_lifted"));
        }
      }
    }
    
    // Level 5: Final fallback - any truck/SUV builds
    if (results.length < limit) {
      const fallbackQuery = `
        SELECT * FROM gallery_assets
        WHERE vehicle_type IN ('truck', 'suv', 'jeep')
          AND thumbnail_url IS NOT NULL
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
          RANDOM()
        LIMIT $1
      `;
      const fallbackResult = await pool.query<GalleryAsset>(fallbackQuery, [
        limit - results.length
      ]);
      
      for (const row of fallbackResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "fallback"));
        }
      }
    }
    
    // Determine overall match quality
    const matchQuality = results.length === 0 
      ? "none"
      : results.some(r => r.matchLevel === "exact_lift")
        ? "exact"
        : results.some(r => r.matchLevel === "same_type_lifted" || r.matchLevel === "same_type")
          ? "partial"
          : "fallback";
    
    return NextResponse.json({
      results: results.slice(0, limit),
      matchQuality,
      matchedOn: {
        vehicleType: effectiveVehicleType,
        buildType,
        liftRange,
        isLifted,
      },
      totalMatches: results.length,
    });
    
  } catch (error) {
    console.error("[gallery/builds] Error:", error);
    return NextResponse.json({
      results: [],
      matchQuality: "error",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

function mapToResult(row: GalleryAsset, matchLevel: BuildMatch["matchLevel"]): BuildMatch {
  return {
    id: row.id,
    albumName: row.source_album_name,
    thumbnailUrl: row.thumbnail_url,
    fullImageUrl: row.source_url,
    wheelBrand: row.wheel_brand,
    wheelModel: row.wheel_model,
    vehicleYear: row.vehicle_year,
    vehicleMake: row.vehicle_make,
    vehicleModel: row.vehicle_model,
    vehicleTrim: row.vehicle_trim,
    vehicleType: row.vehicle_type,
    liftLevel: row.lift_level,
    buildStyle: row.build_style,
    matchLevel,
  };
}
