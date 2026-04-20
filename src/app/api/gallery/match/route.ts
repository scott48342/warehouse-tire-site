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

// Map vehicle models to broader types for fallback matching
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

// Extract clean wheel model name from title/sku string
// e.g., "SURGE 18X9 6X135 87 +20 M-BLK GB-LP" → "Surge"
// e.g., "Fuel Surge" → "Surge"  
// e.g., "Rebel D679" → "Rebel"
function normalizeWheelModel(model: string): string {
  if (!model) return "";
  
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
    
    // Skip product codes like "D679", "FC881"
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
  const inferredType = vehicleType || inferVehicleType(vehicleMake, vehicleModel);
  
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
    // Level 1: Exact wheel model + same make/model
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
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
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
    if (results.length < limit && inferredType) {
      const wheelTypeQuery = `
        SELECT * FROM gallery_assets
        WHERE wheel_brand = $1
          AND LOWER(wheel_model) = LOWER($2)
          AND vehicle_type = $3
          AND thumbnail_url IS NOT NULL
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
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
    if (results.length < limit && inferredType) {
      const brandTypeQuery = `
        SELECT * FROM gallery_assets
        WHERE wheel_brand = $1
          AND vehicle_type = $2
          AND thumbnail_url IS NOT NULL
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
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
    
    // Level 4: Same wheel brand + any vehicle (fallback)
    if (results.length < limit) {
      const fallbackQuery = `
        SELECT * FROM gallery_assets
        WHERE wheel_brand = $1
          AND thumbnail_url IS NOT NULL
        ORDER BY 
          CASE WHEN parse_confidence = 'high' THEN 1 WHEN parse_confidence = 'medium' THEN 2 ELSE 3 END,
          RANDOM()
        LIMIT $2
      `;
      const fallbackResult = await pool.query<GalleryAsset>(fallbackQuery, [
        normalizedBrand,
        limit - results.length
      ]);
      
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
    
    return NextResponse.json({
      results: results.slice(0, limit),
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
