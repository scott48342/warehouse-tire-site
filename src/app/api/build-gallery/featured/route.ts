/**
 * Featured Builds API
 * 
 * GET /api/build-gallery/featured - Get featured builds for homepage
 * Returns 6-12 featured/popular builds with minimal payload
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db";
import { galleryBuilds, buildToJakeContext } from "@/lib/fitment-db/schema";
import { eq, or, desc, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "12"), 24);
    
    // Get featured and popular builds
    const builds = await db
      .select({
        id: galleryBuilds.id,
        slug: galleryBuilds.slug,
        title: galleryBuilds.title,
        vehicleYear: galleryBuilds.vehicleYear,
        vehicleMake: galleryBuilds.vehicleMake,
        vehicleModel: galleryBuilds.vehicleModel,
        buildStyle: galleryBuilds.buildStyle,
        liftLevel: galleryBuilds.liftLevel,
        wheelBrand: galleryBuilds.wheelBrand,
        wheelModel: galleryBuilds.wheelModel,
        wheelSize: galleryBuilds.wheelSize,
        tireBrand: galleryBuilds.tireBrand,
        tireModel: galleryBuilds.tireModel,
        tireSize: galleryBuilds.tireSize,
        heroImageUrl: galleryBuilds.heroImageUrl,
        isFeatured: galleryBuilds.isFeatured,
        isPopular: galleryBuilds.isPopular,
      })
      .from(galleryBuilds)
      .where(
        eq(galleryBuilds.isActive, true)
      )
      .orderBy(
        desc(galleryBuilds.isFeatured),
        desc(galleryBuilds.isPopular),
        asc(galleryBuilds.displayOrder),
        desc(galleryBuilds.createdAt)
      )
      .limit(limit);
    
    // Add Jake context for each build (for "Build Something Similar" CTA)
    const buildsWithContext = builds.map(build => ({
      ...build,
      jakeContext: buildToJakeContext(build as any),
      vehicleLabel: `${build.vehicleYear} ${build.vehicleMake} ${build.vehicleModel}`,
      wheelLabel: `${build.wheelBrand} ${build.wheelModel}`,
      tireLabel: `${build.tireBrand} ${build.tireModel}`,
      styleLabel: build.buildStyle.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    }));
    
    return NextResponse.json({ builds: buildsWithContext });
  } catch (error) {
    console.error("[build-gallery] featured error:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured builds", builds: [] },
      { status: 500 }
    );
  }
}
