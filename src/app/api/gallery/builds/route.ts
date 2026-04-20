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

// Vehicle type classification
export type VehicleTypeSegment = "truck" | "suv" | "jeep" | "car" | null;

// Infer vehicle type from make/model
function inferVehicleType(make?: string, model?: string): VehicleTypeSegment {
  if (!model) return null;
  const m = model.toLowerCase();
  const mk = make?.toLowerCase() || "";
  
  // Trucks (check first - most specific)
  if (m.includes("f-150") || m.includes("f150") || m.includes("f-250") || m.includes("f-350") ||
      m.includes("silverado") || m.includes("sierra") ||
      m.includes("ram") || m.includes("1500") || m.includes("2500") || m.includes("3500") ||
      m.includes("tundra") || m.includes("tacoma") || m.includes("ranger") ||
      m.includes("colorado") || m.includes("gladiator") ||
      m.includes("titan") || m.includes("frontier") || m.includes("canyon") ||
      m.includes("ridgeline") || m.includes("maverick") || m.includes("santa cruz")) {
    return "truck";
  }
  
  // Jeeps
  if (mk === "jeep" || m.includes("wrangler") || m.includes("rubicon") ||
      m.includes("gladiator") || m.includes("cherokee") || m.includes("compass") ||
      m.includes("renegade") || m.includes("grand cherokee")) {
    return "jeep";
  }
  
  // SUVs
  if (m.includes("bronco") || m.includes("4runner") ||
      m.includes("tahoe") || m.includes("suburban") ||
      m.includes("yukon") || m.includes("escalade") ||
      m.includes("sequoia") || m.includes("land cruiser") ||
      m.includes("gx") || m.includes("expedition") ||
      m.includes("durango") || m.includes("armada") ||
      m.includes("pilot") || m.includes("highlander") ||
      m.includes("explorer") || m.includes("telluride") ||
      m.includes("palisade") || m.includes("pathfinder")) {
    return "suv";
  }
  
  // Cars (performance, muscle, sports, sedans, coupes)
  // Performance / Muscle
  if (m.includes("mustang") || m.includes("camaro") || m.includes("challenger") ||
      m.includes("charger") || m.includes("corvette") || m.includes("viper") ||
      m.includes("gt500") || m.includes("gt350") || m.includes("hellcat") ||
      m.includes("demon") || m.includes("scat pack") || m.includes("dark horse")) {
    return "car";
  }
  
  // Sports / Luxury
  if (m.includes("911") || m.includes("cayman") || m.includes("boxster") ||
      m.includes("supra") || m.includes("z4") || m.includes("86") || m.includes("brz") ||
      m.includes("miata") || m.includes("mx-5") || m.includes("370z") || m.includes("400z") ||
      m.includes("gtr") || m.includes("gt-r") || m.includes("nsx") ||
      m.includes("m3") || m.includes("m4") || m.includes("m5") || m.includes("m2") ||
      m.includes("amg") || m.includes("rs3") || m.includes("rs5") || m.includes("rs6") ||
      m.includes("rs7") || m.includes("c63") || m.includes("e63")) {
    return "car";
  }
  
  // Sedans / Coupes
  if (m.includes("accord") || m.includes("camry") || m.includes("civic") ||
      m.includes("corolla") || m.includes("altima") || m.includes("maxima") ||
      m.includes("3 series") || m.includes("5 series") || m.includes("7 series") ||
      m.includes("a4") || m.includes("a6") || m.includes("s4") || m.includes("s5") ||
      m.includes("c-class") || m.includes("e-class") || m.includes("s-class") ||
      m.includes("is") || m.includes("es") || m.includes("gs") || m.includes("ls") ||
      m.includes("genesis") || m.includes("g70") || m.includes("g80") || m.includes("g90") ||
      m.includes("ct4") || m.includes("ct5") || m.includes("ats") || m.includes("cts") ||
      m.includes("ss") || m.includes("impala") || m.includes("malibu") ||
      m.includes("fusion") || m.includes("taurus") ||
      m.includes("wrx") || m.includes("sti") || m.includes("type r") ||
      m.includes("veloster") || m.includes("elantra n") || m.includes("forte")) {
    return "car";
  }
  
  // Hot hatches / Compacts
  if (m.includes("golf") || m.includes("gti") || m.includes("golf r") ||
      m.includes("focus") || m.includes("fiesta") || m.includes("st ") ||
      m.includes(" si") || m.includes("sport hatch")) {
    return "car";
  }
  
  return null;
}

// Check if vehicle type is a "off-road" type (uses build/lift levels)
function isOffRoadVehicleType(vehicleType: VehicleTypeSegment): boolean {
  return vehicleType === "truck" || vehicleType === "suv" || vehicleType === "jeep";
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
  const effectiveVehicleType = (vehicleType || inferVehicleType(vehicleMake, vehicleModel)) as VehicleTypeSegment;
  const { isLifted, liftRange } = normalizeBuildType(buildType, liftedInches);
  
  // Cars don't have "builds" (lifted/leveled) - use WheelGalleryBlock instead
  // This prevents cross-contamination of truck images into car flows
  if (effectiveVehicleType === "car") {
    return NextResponse.json({
      results: [],
      matchQuality: "none",
      reason: "Car vehicle - use wheel gallery instead of build gallery",
      vehicleType: "car",
    });
  }
  
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
    // Only return images with working Vercel Blob URLs
    const blobFilter = "(thumbnail_url LIKE '%blob.vercel%' OR source_url LIKE '%blob.vercel%')";
    
    // Level 1: Same vehicle type + matching lift range (if we have lift data)
    // PRIORITY for all queries: Customer submissions (verified) > Brand assets (high) > Auto-parsed
    if (effectiveVehicleType && liftRange) {
      const exactLiftQuery = `
        SELECT * FROM gallery_assets
        WHERE vehicle_type = $1
          AND lift_level = $2
          AND thumbnail_url IS NOT NULL
          AND ${blobFilter}
        ORDER BY 
          CASE WHEN parse_confidence = 'verified' THEN 0 
               WHEN parse_confidence = 'high' THEN 1 
               WHEN parse_confidence = 'medium' THEN 2 
               ELSE 3 END,
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
          AND ${blobFilter}
        ORDER BY 
          CASE WHEN parse_confidence = 'verified' THEN 0 
               WHEN parse_confidence = 'high' THEN 1 
               WHEN parse_confidence = 'medium' THEN 2 
               ELSE 3 END,
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
          AND ${blobFilter}
        ORDER BY 
          CASE WHEN parse_confidence = 'verified' THEN 0 
               WHEN parse_confidence = 'high' THEN 1 
               WHEN parse_confidence = 'medium' THEN 2 
               ELSE 3 END,
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
          AND ${blobFilter}
        ORDER BY 
          CASE WHEN parse_confidence = 'verified' THEN 0 
               WHEN parse_confidence = 'high' THEN 1 
               WHEN parse_confidence = 'medium' THEN 2 
               ELSE 3 END,
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
          AND ${blobFilter}
        Order BY 
          CASE WHEN parse_confidence = 'verified' THEN 0 
               WHEN parse_confidence = 'high' THEN 1 
               WHEN parse_confidence = 'medium' THEN 2 
               ELSE 3 END,
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
