/**
 * Visualizer Wheels API
 * 
 * GET: Get front-facing wheel styles for the visualizer
 * 
 * Returns only wheels that are classified as front-facing and usable.
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb } from "@/lib/visualizer/db";
import { wheelStyleAssets } from "@/lib/visualizer/schema";
import { eq, and, ilike, or, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const brand = url.searchParams.get("brand");
  const search = url.searchParams.get("search");
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
  const offset = parseInt(url.searchParams.get("offset") || "0");
  
  try {
    // Base condition: front-facing and usable
    const conditions = [
      eq(wheelStyleAssets.isFrontFacing, true),
      eq(wheelStyleAssets.visualizerStatus, "usable"),
    ];
    
    // Optional brand filter
    if (brand) {
      conditions.push(ilike(wheelStyleAssets.brand, `%${brand}%`));
    }
    
    // Optional search (brand or model)
    if (search) {
      conditions.push(
        or(
          ilike(wheelStyleAssets.brand, `%${search}%`),
          ilike(wheelStyleAssets.model, `%${search}%`)
        )!
      );
    }
    
    const wheels = await visualizerDb
      .select({
        styleKey: wheelStyleAssets.styleKey,
        brand: wheelStyleAssets.brand,
        brandCode: wheelStyleAssets.brandCode,
        model: wheelStyleAssets.model,
        imageUrl: wheelStyleAssets.imageUrl,
        normalizedImageUrl: wheelStyleAssets.normalizedImageUrl,
      })
      .from(wheelStyleAssets)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const [countResult] = await visualizerDb
      .select({ count: count() })
      .from(wheelStyleAssets)
      .where(and(...conditions));
    
    // Get unique brands for filtering
    const brands = await visualizerDb
      .selectDistinct({ brand: wheelStyleAssets.brand })
      .from(wheelStyleAssets)
      .where(
        and(
          eq(wheelStyleAssets.isFrontFacing, true),
          eq(wheelStyleAssets.visualizerStatus, "usable")
        )
      );
    
    return NextResponse.json({
      wheels: wheels.map(w => ({
        ...w,
        // Use normalized image if available, else original
        displayImageUrl: w.normalizedImageUrl || w.imageUrl,
      })),
      total: Number(countResult?.count || 0),
      pagination: { limit, offset },
      brands: brands.map(b => b.brand).filter(Boolean).sort(),
    });
    
  } catch (error) {
    console.error("[visualizer/wheels] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wheels" },
      { status: 500 }
    );
  }
}
