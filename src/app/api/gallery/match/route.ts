/**
 * Gallery Match API
 * 
 * Returns relevant real-vehicle images from the WheelPros Canto gallery
 * based on wheel and vehicle context.
 * 
 * Matching priority:
 * 1. Exact wheel model + same make/model
 * 2. Exact wheel model + same vehicle type
 * 3. Same wheel brand + same vehicle type
 * 4. Same wheel brand + fallback vehicle type
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
  parse_confidence: string;
}

interface MatchResult {
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
  matchLevel: "exact" | "wheel_type" | "brand_type" | "brand_fallback";
  matchConfidence: "high" | "medium" | "low";
}

// Map common wheel brand names to our gallery brand values
const BRAND_MAP: Record<string, string> = {
  "fuel": "Fuel",
  "fuel 1pc": "Fuel",
  "fuel off-road": "Fuel",
  "fuel offroad": "Fuel",
  "kmc": "KMC",
  "moto metal": "Moto Metal",
  "xd": "XD",
  "xd series": "XD",
  "black rhino": "Black Rhino",
  "black rhino hard alloys": "Black Rhino",
  "asanti": "Asanti",
  "asanti black": "Asanti",
  "dub": "DUB",
  "dub 1pc": "DUB",
  // Add more as needed
};

// Vehicle type classification
type VehicleTypeSegment = "truck" | "suv" | "jeep" | "car" | null;

// Map vehicle models to broader types for fallback matching
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
      m.includes("cherokee") || m.includes("compass") ||
      m.includes("renegade") || m.includes("grand cherokee")) {
    // Note: gladiator is already caught by trucks above
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

// Check if vehicle type is a "off-road" type (trucks/SUVs/Jeeps)
function isOffRoadVehicleType(vehicleType: VehicleTypeSegment): boolean {
  return vehicleType === "truck" || vehicleType === "suv" || vehicleType === "jeep";
}

// Extract clean wheel model name from title/sku string
// e.g., "SURGE 18X9 6X135 87 +20 M-BLK GB-LP" → "Surge"
// e.g., "Fuel Surge" → "Surge"  
// e.g., "Rebel D679" → "Rebel"
// e.g., "KM447" → "KM447" (KMC model codes are the actual model names)
function normalizeWheelModel(model: string): string {
  if (!model) return "";
  
  // KMC, XD, and Moto Metal use alphanumeric codes as model names
  // e.g., KM447, KM235, XD820, MO970 - these ARE the model names
  const kmcStyleMatch = model.match(/^(KM\d{3}|XD\d{3}|MO\d{3})/i);
  if (kmcStyleMatch) {
    return kmcStyleMatch[1].toUpperCase();
  }
  
  // Remove common brand prefixes
  let cleaned = model
    .replace(/^fuel\s*(1pc|off-?road)?\s*/i, "")
    .replace(/^kmc\s*/i, "")
    .replace(/^moto\s*metal\s*/i, "")
    .replace(/^xd\s*(series)?\s*/i, "")
    .replace(/^black\s*rhino\s*(hard\s*alloys?)?\s*/i, "")
    .replace(/^asanti\s*(black)?\s*/i, "")
    .replace(/^dub\s*(1pc)?\s*/i, "")
    .trim();
  
  // Split into words
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  
  // Find where the model name ends:
  // - Stop at size patterns like "18X9", "20X10"
  // - Stop at bolt patterns like "6X135", "5X114.3"
  // - Stop at numeric-only tokens
  const modelWords: string[] = [];
  for (const word of words) {
    const w = word.toUpperCase();
    
    // Stop at size pattern (digits X digits)
    if (/^\d+(\.\d+)?X\d+(\.\d+)?$/i.test(w)) break;
    
    // Stop at bolt pattern (looking like 6X135)
    if (/^\d+X\d{3,}$/i.test(w)) break;
    
    // Stop at pure numbers (offsets, etc.)
    if (/^-?\d+(\.\d+)?$/.test(w)) break;
    
    // Stop at finish codes like "M-BLK", "GB-LP", etc.
    if (/^[A-Z]{1,2}-[A-Z]{2,}$/i.test(w)) break;
    
    // Skip product codes like "D679", "FC881" (but NOT KMC/XD/MO codes - handled above)
    if (/^[A-Z]{1,2}\d{2,}$/i.test(w)) continue;
    
    modelWords.push(word);
    
    // Usually model name is 1-2 words max
    if (modelWords.length >= 2) break;
  }
  
  if (modelWords.length === 0) return "";
  
  // Title case the result
  return modelWords
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const wheelBrand = searchParams.get("wheelBrand") || "";
  const wheelModel = searchParams.get("wheelModel") || "";
  const vehicleYear = searchParams.get("year") || "";
  const vehicleMake = searchParams.get("make") || "";
  const vehicleModel = searchParams.get("model") || "";
  const vehicleType = searchParams.get("vehicleType") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "6", 10), 10);
  
  // Normalize inputs
  const normalizedBrand = BRAND_MAP[wheelBrand.toLowerCase()] || wheelBrand || "Fuel";
  const normalizedWheelModel = normalizeWheelModel(wheelModel);
  // Type-safe vehicle type inference - ensures proper segmentation
  const inferredType: VehicleTypeSegment = (vehicleType as VehicleTypeSegment) || inferVehicleType(vehicleMake, vehicleModel);
  
  // No wheel model = no useful results
  if (!normalizedWheelModel) {
    return NextResponse.json({
      results: [],
      matchQuality: "none",
      debug: { reason: "No wheel model provided" }
    });
  }
  
  const results: MatchResult[] = [];
  const seenIds = new Set<number>();
  
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({
      results: [],
      matchQuality: "error",
      error: "Database not configured"
    }, { status: 500 });
  }
  
  try {
    // Only return images with working Vercel Blob URLs
    const blobFilter = "(thumbnail_url LIKE '%blob.vercel%' OR source_url LIKE '%blob.vercel%')";
    
    // Level 1: Exact wheel model + same make/model
    // PRIORITY: Customer submissions (verified) > Brand assets (high) > Auto-parsed
    if (vehicleMake && vehicleModel) {
      const exactQuery = `
        SELECT * FROM gallery_assets
        WHERE wheel_brand = $1
          AND LOWER(wheel_model) = LOWER($2)
          AND LOWER(vehicle_make) = LOWER($3)
          AND (
            LOWER(vehicle_model) LIKE LOWER($4)
            OR LOWER($5) LIKE '%' || LOWER(vehicle_model) || '%'
          )
          AND thumbnail_url IS NOT NULL
          AND ${blobFilter}
        ORDER BY 
          CASE WHEN parse_confidence = 'verified' THEN 0 
               WHEN parse_confidence = 'high' THEN 1 
               WHEN parse_confidence = 'medium' THEN 2 
               ELSE 3 END,
          vehicle_year DESC NULLS LAST
        LIMIT $6
      `;
      const exactResult = await pool.query<GalleryAsset>(exactQuery, [
        normalizedBrand,
        normalizedWheelModel,
        vehicleMake,
        '%' + vehicleModel + '%',
        vehicleModel,
        limit
      ]);
      
      for (const row of exactResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "exact"));
        }
      }
    }
    
    // Level 2: Exact wheel model + same vehicle type
    // PRIORITY: Customer submissions first
    if (results.length < limit && inferredType) {
      const wheelTypeQuery = `
        SELECT * FROM gallery_assets
        WHERE wheel_brand = $1
          AND LOWER(wheel_model) = LOWER($2)
          AND vehicle_type = $3
          AND thumbnail_url IS NOT NULL
          AND ${blobFilter}
        ORDER BY 
          CASE WHEN parse_confidence = 'verified' THEN 0 
               WHEN parse_confidence = 'high' THEN 1 
               WHEN parse_confidence = 'medium' THEN 2 
               ELSE 3 END,
          vehicle_year DESC NULLS LAST
        LIMIT $4
      `;
      const wheelTypeResult = await pool.query<GalleryAsset>(wheelTypeQuery, [
        normalizedBrand,
        normalizedWheelModel,
        inferredType,
        limit - results.length
      ]);
      
      for (const row of wheelTypeResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "wheel_type"));
        }
      }
    }
    
    // Level 3: Same wheel brand + same vehicle type (any wheel model)
    // PRIORITY: Customer submissions first
    if (results.length < limit && inferredType) {
      const brandTypeQuery = `
        SELECT * FROM gallery_assets
        WHERE wheel_brand = $1
          AND vehicle_type = $2
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
      const brandTypeResult = await pool.query<GalleryAsset>(brandTypeQuery, [
        normalizedBrand,
        inferredType,
        limit - results.length
      ]);
      
      for (const row of brandTypeResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "brand_type"));
        }
      }
    }
    
    // Level 4: Same wheel brand + segmented fallback (prevents cross-contamination)
    // Cars only get car images, trucks/SUVs/jeeps only get off-road images
    if (results.length < limit) {
      // Determine vehicle type segment for filtering
      const isCarContext = inferredType === "car";
      const isOffRoadContext = isOffRoadVehicleType(inferredType);
      
      let fallbackQuery: string;
      let fallbackParams: (string | number)[];
      
      if (isCarContext) {
        // Car context: only show car images
        // PRIORITY: Customer submissions first
        fallbackQuery = `
          SELECT * FROM gallery_assets
          WHERE wheel_brand = $1
            AND vehicle_type = 'car'
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
        fallbackParams = [normalizedBrand, limit - results.length];
      } else if (isOffRoadContext) {
        // Truck/SUV/Jeep context: only show off-road images (never cars)
        // PRIORITY: Customer submissions first
        fallbackQuery = `
          SELECT * FROM gallery_assets
          WHERE wheel_brand = $1
            AND vehicle_type IN ('truck', 'suv', 'jeep')
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
        fallbackParams = [normalizedBrand, limit - results.length];
      } else {
        // Unknown context: prefer off-road images (most of our gallery is trucks/SUVs)
        // PRIORITY: Customer submissions first, then by vehicle type
        fallbackQuery = `
          SELECT * FROM gallery_assets
          WHERE wheel_brand = $1
            AND thumbnail_url IS NOT NULL
            AND ${blobFilter}
          ORDER BY 
            CASE WHEN parse_confidence = 'verified' THEN 0 
                 WHEN parse_confidence = 'high' THEN 1 
                 WHEN parse_confidence = 'medium' THEN 2 
                 ELSE 3 END,
            CASE WHEN vehicle_type IN ('truck', 'suv', 'jeep') THEN 1 ELSE 2 END,
            RANDOM()
          LIMIT $2
        `;
        fallbackParams = [normalizedBrand, limit - results.length];
      }
      
      const fallbackResult = await pool.query<GalleryAsset>(fallbackQuery, fallbackParams);
      
      for (const row of fallbackResult.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(mapToResult(row, "brand_fallback"));
        }
      }
    }
    
    // Determine overall match quality
    const matchQuality = results.length === 0 
      ? "none"
      : results.some(r => r.matchLevel === "exact")
        ? "exact"
        : results.some(r => r.matchLevel === "wheel_type")
          ? "partial"
          : "fallback";
    
    // Apply diversity filter: max 2 images per album/vehicle combo
    const diversifiedResults = diversifyResults(results, limit);
    
    return NextResponse.json({
      results: diversifiedResults,
      matchQuality,
      matchedOn: {
        wheelBrand: normalizedBrand,
        wheelModel: normalizedWheelModel,
        vehicleType: inferredType,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
      },
      totalMatches: results.length,
    });
    
  } catch (error) {
    console.error("[gallery/match] Error:", error);
    return NextResponse.json({
      results: [],
      matchQuality: "error",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// Diversify results to avoid showing too many images from the same album/vehicle
// Max 2 images per unique vehicle (make+model combo)
function diversifyResults(results: MatchResult[], limit: number): MatchResult[] {
  const vehicleCounts = new Map<string, number>();
  const diversified: MatchResult[] = [];
  
  const MAX_PER_VEHICLE = 2;
  
  for (const result of results) {
    if (diversified.length >= limit) break;
    
    // Create a key for this vehicle (make + model, ignoring year/trim variations)
    const vehicleKey = `${(result.vehicleMake || '').toLowerCase()}_${(result.vehicleModel || '').toLowerCase()}`;
    const currentCount = vehicleCounts.get(vehicleKey) || 0;
    
    if (currentCount < MAX_PER_VEHICLE) {
      diversified.push(result);
      vehicleCounts.set(vehicleKey, currentCount + 1);
    }
  }
  
  // If we didn't reach the limit, fill with remaining results
  if (diversified.length < limit) {
    for (const result of results) {
      if (diversified.length >= limit) break;
      if (!diversified.some(r => r.id === result.id)) {
        diversified.push(result);
      }
    }
  }
  
  return diversified;
}

function mapToResult(row: GalleryAsset, matchLevel: MatchResult["matchLevel"]): MatchResult {
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
    matchLevel,
    matchConfidence: row.parse_confidence === "high" ? "high" : row.parse_confidence === "medium" ? "medium" : "low",
  };
}

