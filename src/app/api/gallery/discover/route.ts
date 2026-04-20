/**
 * Gallery Discovery API
 * 
 * GET /api/gallery/discover
 * Returns gallery assets for browsing with filters
 * Prioritizes customer builds (verified) over brand assets
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";

interface GalleryAssetRow {
  id: number;
  source_album_name: string;
  thumbnail_url: string;
  source_url: string;
  wheel_brand: string;
  wheel_model: string;
  wheel_sku: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_trim: string | null;
  vehicle_type: string | null;
  lift_level: string | null;
  build_style: string | null;
  parse_confidence: string;
  is_featured: boolean;
  // From customer_builds join (for customer submissions)
  instagram_handle?: string | null;
  customer_name?: string | null;
}

interface DiscoverResult {
  id: number;
  thumbnailUrl: string;
  fullImageUrl: string;
  wheelBrand: string;
  wheelModel: string;
  wheelSku: string | null;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  vehicleType: string | null;
  liftLevel: string | null;
  buildStyle: string | null;
  isCustomerBuild: boolean;
  isFeatured: boolean;
  customerName: string | null;
  instagramHandle: string | null;
  albumName: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Filters
  const vehicleMake = searchParams.get("make") || "";
  const vehicleModel = searchParams.get("model") || "";
  const vehicleType = searchParams.get("vehicleType") || "";
  const wheelBrand = searchParams.get("wheelBrand") || "";
  const wheelModel = searchParams.get("wheelModel") || "";
  const buildType = searchParams.get("buildType") || ""; // stock | leveled | lifted
  const featured = searchParams.get("featured") === "true";
  const customerOnly = searchParams.get("customerOnly") === "true";
  
  // Pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "24")));
  const offset = (page - 1) * limit;
  
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  
  try {
    // Build WHERE clause dynamically
    const conditions: string[] = ["thumbnail_url IS NOT NULL"];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;
    
    if (vehicleMake) {
      conditions.push(`LOWER(vehicle_make) = LOWER($${paramIndex++})`);
      params.push(vehicleMake);
    }
    
    if (vehicleModel) {
      conditions.push(`LOWER(vehicle_model) LIKE LOWER($${paramIndex++})`);
      params.push(`%${vehicleModel}%`);
    }
    
    if (vehicleType) {
      conditions.push(`vehicle_type = $${paramIndex++}`);
      params.push(vehicleType);
    }
    
    if (wheelBrand) {
      conditions.push(`LOWER(wheel_brand) = LOWER($${paramIndex++})`);
      params.push(wheelBrand);
    }
    
    if (wheelModel) {
      conditions.push(`LOWER(wheel_model) LIKE LOWER($${paramIndex++})`);
      params.push(`%${wheelModel}%`);
    }
    
    if (buildType) {
      if (buildType === "stock") {
        conditions.push(`(lift_level IS NULL OR lift_level = 'stock')`);
      } else if (buildType === "leveled") {
        conditions.push(`lift_level IN ('leveled', '1-2', '2')`);
      } else if (buildType === "lifted") {
        conditions.push(`lift_level IS NOT NULL AND lift_level NOT IN ('stock', 'leveled', '1-2')`);
      }
    }
    
    if (featured) {
      conditions.push(`is_featured = true`);
    }
    
    if (customerOnly) {
      conditions.push(`parse_confidence = 'verified'`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // Main query with priority ordering: customer builds first, then featured, then by confidence
    const query = `
      SELECT 
        id,
        source_album_name,
        thumbnail_url,
        source_url,
        wheel_brand,
        wheel_model,
        wheel_sku,
        vehicle_year,
        vehicle_make,
        vehicle_model,
        vehicle_trim,
        vehicle_type,
        lift_level,
        build_style,
        parse_confidence,
        is_featured
      FROM gallery_assets
      ${whereClause}
      ORDER BY 
        CASE WHEN parse_confidence = 'verified' THEN 0 ELSE 1 END,
        is_featured DESC,
        CASE WHEN parse_confidence = 'high' THEN 0 WHEN parse_confidence = 'medium' THEN 1 ELSE 2 END,
        vehicle_year DESC NULLS LAST,
        id DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    params.push(limit, offset);
    
    const result = await pool.query<GalleryAssetRow>(query, params);
    
    // Count query for pagination
    const countQuery = `SELECT COUNT(*) as total FROM gallery_assets ${whereClause}`;
    const countResult = await pool.query<{ total: string }>(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.total || "0");
    
    // Map results
    const results: DiscoverResult[] = result.rows.map((row) => ({
      id: row.id,
      thumbnailUrl: row.thumbnail_url,
      fullImageUrl: row.source_url,
      wheelBrand: row.wheel_brand,
      wheelModel: row.wheel_model,
      wheelSku: row.wheel_sku,
      vehicleYear: row.vehicle_year,
      vehicleMake: row.vehicle_make,
      vehicleModel: row.vehicle_model,
      vehicleTrim: row.vehicle_trim,
      vehicleType: row.vehicle_type,
      liftLevel: row.lift_level,
      buildStyle: row.build_style,
      isCustomerBuild: row.parse_confidence === "verified",
      isFeatured: row.is_featured,
      customerName: row.customer_name || null,
      instagramHandle: row.instagram_handle || null,
      albumName: row.source_album_name,
    }));
    
    return NextResponse.json({
      results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: {
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehicleType: vehicleType || null,
        wheelBrand: wheelBrand || null,
        wheelModel: wheelModel || null,
        buildType: buildType || null,
        featured,
        customerOnly,
      },
    });
    
  } catch (error) {
    console.error("[gallery/discover] Error:", error);
    return NextResponse.json({ error: "Failed to fetch gallery" }, { status: 500 });
  }
}
