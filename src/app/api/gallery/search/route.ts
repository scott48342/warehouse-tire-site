/**
 * Gallery Search API
 * 
 * GET /api/gallery/search?year=2024&make=Ford&model=F-150&wheelDiameter=20&liftLevel=leveled
 * 
 * Returns build images matching the user's vehicle and build preferences.
 * Used for "See builds like this" feature during wheel selection.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { galleryImages } from "@/lib/gallery/schema";
import { and, eq, ilike, gte, lte, or, sql, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GallerySearchParams {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  wheelDiameter?: string;
  wheelBrand?: string;
  liftLevel?: string;
  fitmentType?: string;
  buildStyle?: string;
  limit?: string;
  offset?: string;
  featured?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  
  try {
    // Parse query params
    const params: GallerySearchParams = {
      year: searchParams.get("year") || undefined,
      make: searchParams.get("make") || undefined,
      model: searchParams.get("model") || undefined,
      trim: searchParams.get("trim") || undefined,
      wheelDiameter: searchParams.get("wheelDiameter") || undefined,
      wheelBrand: searchParams.get("wheelBrand") || undefined,
      liftLevel: searchParams.get("liftLevel") || undefined,
      fitmentType: searchParams.get("fitmentType") || undefined,
      buildStyle: searchParams.get("buildStyle") || undefined,
      limit: searchParams.get("limit") || "12",
      offset: searchParams.get("offset") || "0",
      featured: searchParams.get("featured") || undefined,
    };
    
    const limit = Math.min(parseInt(params.limit || "12", 10), 50);
    const offset = parseInt(params.offset || "0", 10);
    
    // Build conditions
    const conditions: ReturnType<typeof and>[] = [];
    
    // Always filter to active status
    conditions.push(eq(galleryImages.status, "active"));
    
    // Vehicle matching (fuzzy for make/model)
    if (params.year) {
      const year = parseInt(params.year, 10);
      // Match within 3 years for more results
      conditions.push(gte(galleryImages.vehicleYear, year - 2));
      conditions.push(lte(galleryImages.vehicleYear, year + 2));
    }
    
    if (params.make) {
      conditions.push(ilike(galleryImages.vehicleMake, params.make));
    }
    
    if (params.model) {
      // Fuzzy match model (e.g., "F-150" matches "F-150 XLT", "F-150 Raptor")
      conditions.push(ilike(galleryImages.vehicleModel, `%${params.model}%`));
    }
    
    // Wheel specs
    if (params.wheelDiameter) {
      const diameter = parseInt(params.wheelDiameter, 10);
      conditions.push(eq(galleryImages.wheelDiameter, diameter));
    }
    
    if (params.wheelBrand) {
      conditions.push(ilike(galleryImages.wheelBrand, `%${params.wheelBrand}%`));
    }
    
    // Lift level
    if (params.liftLevel) {
      // Map general terms to specific values
      const liftMap: Record<string, string[]> = {
        stock: ["stock"],
        leveled: ["leveled"],
        lifted: ["lifted", "lifted_2", "lifted_4", "lifted_6"],
        lowered: ["lowered", "slammed"],
      };
      const levels = liftMap[params.liftLevel] || [params.liftLevel];
      
      if (levels.length === 1) {
        conditions.push(eq(galleryImages.liftLevel, levels[0]));
      } else {
        conditions.push(
          or(...levels.map((l) => eq(galleryImages.liftLevel, l)))
        );
      }
    }
    
    // Fitment type
    if (params.fitmentType) {
      conditions.push(eq(galleryImages.fitmentType, params.fitmentType));
    }
    
    // Build style
    if (params.buildStyle) {
      conditions.push(eq(galleryImages.buildStyle, params.buildStyle));
    }
    
    // Featured only
    if (params.featured === "true") {
      conditions.push(eq(galleryImages.featured, true));
    }
    
    // Execute query
    const results = await db
      .select()
      .from(galleryImages)
      .where(and(...conditions))
      .orderBy(
        desc(galleryImages.featured),
        desc(galleryImages.viewCount),
        desc(galleryImages.createdAt)
      )
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(galleryImages)
      .where(and(...conditions));
    
    const totalCount = Number(countResult[0]?.count || 0);
    
    const response = {
      images: results.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        thumbnailUrl: img.thumbnailUrl || img.imageUrl,
        sourceUrl: img.sourceUrl,
        
        vehicle: {
          year: img.vehicleYear,
          make: img.vehicleMake,
          model: img.vehicleModel,
          trim: img.vehicleTrim,
        },
        
        wheel: {
          brand: img.wheelBrand,
          model: img.wheelModel,
          diameter: img.wheelDiameter,
          width: img.wheelWidth ? Number(img.wheelWidth) : null,
          offsetMm: img.wheelOffsetMm,
        },
        
        rearWheel: img.isStaggered
          ? {
              diameter: img.rearWheelDiameter,
              width: img.rearWheelWidth ? Number(img.rearWheelWidth) : null,
              offsetMm: img.rearWheelOffsetMm,
            }
          : null,
        
        tire: {
          brand: img.tireBrand,
          model: img.tireModel,
          size: img.tireSize,
          rearSize: img.rearTireSize,
        },
        
        suspension: {
          type: img.suspensionType,
          brand: img.suspensionBrand,
          liftLevel: img.liftLevel,
        },
        
        fitment: {
          type: img.fitmentType,
          style: img.buildStyle,
          isStaggered: img.isStaggered,
        },
        
        title: img.title,
        tags: img.tags,
        viewCount: img.viewCount,
        featured: img.featured,
      })),
      
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + results.length < totalCount,
      },
      
      meta: {
        tookMs: Date.now() - startTime,
        params: {
          year: params.year,
          make: params.make,
          model: params.model,
          wheelDiameter: params.wheelDiameter,
          liftLevel: params.liftLevel,
        },
      },
    };
    
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
    
  } catch (error) {
    console.error("[gallery/search] Error:", error);
    
    return NextResponse.json(
      {
        error: "Gallery search failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
