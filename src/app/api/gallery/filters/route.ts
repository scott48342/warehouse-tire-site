/**
 * Gallery Filter Options API
 * 
 * GET /api/gallery/filters
 * Returns available filter options based on gallery data
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";

interface FilterOption {
  value: string;
  count: number;
}

export async function GET() {
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  
  try {
    // Get vehicle makes
    const makesResult = await pool.query<{ vehicle_make: string; count: string }>(`
      SELECT vehicle_make, COUNT(*) as count 
      FROM gallery_assets 
      WHERE vehicle_make IS NOT NULL AND thumbnail_url IS NOT NULL
      GROUP BY vehicle_make 
      ORDER BY count DESC
      LIMIT 30
    `);
    
    // Get wheel brands
    const brandsResult = await pool.query<{ wheel_brand: string; count: string }>(`
      SELECT wheel_brand, COUNT(*) as count 
      FROM gallery_assets 
      WHERE wheel_brand IS NOT NULL AND thumbnail_url IS NOT NULL
      GROUP BY wheel_brand 
      ORDER BY count DESC
      LIMIT 30
    `);
    
    // Get vehicle types
    const typesResult = await pool.query<{ vehicle_type: string; count: string }>(`
      SELECT vehicle_type, COUNT(*) as count 
      FROM gallery_assets 
      WHERE vehicle_type IS NOT NULL AND thumbnail_url IS NOT NULL
      GROUP BY vehicle_type 
      ORDER BY count DESC
    `);
    
    // Get build types (derived from lift_level)
    const buildTypesResult = await pool.query<{ build_type: string; count: string }>(`
      SELECT 
        CASE 
          WHEN lift_level IS NULL OR lift_level = 'stock' THEN 'stock'
          WHEN lift_level IN ('leveled', '1-2', '2') THEN 'leveled'
          ELSE 'lifted'
        END as build_type,
        COUNT(*) as count
      FROM gallery_assets 
      WHERE thumbnail_url IS NOT NULL
      GROUP BY build_type
      ORDER BY count DESC
    `);
    
    // Get total counts
    const totalResult = await pool.query<{ total: string; customer_builds: string }>(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE parse_confidence = 'verified') as customer_builds
      FROM gallery_assets 
      WHERE thumbnail_url IS NOT NULL
    `);
    
    return NextResponse.json({
      makes: makesResult.rows.map((r) => ({ value: r.vehicle_make, count: parseInt(r.count) })),
      wheelBrands: brandsResult.rows.map((r) => ({ value: r.wheel_brand, count: parseInt(r.count) })),
      vehicleTypes: typesResult.rows.map((r) => ({ value: r.vehicle_type, count: parseInt(r.count) })),
      buildTypes: buildTypesResult.rows.map((r) => ({ value: r.build_type, count: parseInt(r.count) })),
      totals: {
        all: parseInt(totalResult.rows[0]?.total || "0"),
        customerBuilds: parseInt(totalResult.rows[0]?.customer_builds || "0"),
      },
    });
    
  } catch (error) {
    console.error("[gallery/filters] Error:", error);
    return NextResponse.json({ error: "Failed to fetch filters" }, { status: 500 });
  }
}
