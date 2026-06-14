/**
 * Build Gallery API
 * 
 * GET /api/build-gallery - List builds with filtering
 * POST /api/build-gallery - Create a new build (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db";
import { galleryBuilds, generateBuildSlug } from "@/lib/fitment-db/schema";
import { eq, and, desc, asc, sql, ilike, or } from "drizzle-orm";

// ════════════════════════════════════════════════════════════════════════════════
// GET: List builds with filtering
// ════════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);
    const offset = (page - 1) * limit;
    
    // Filters
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const style = searchParams.get("style");
    const featured = searchParams.get("featured") === "true";
    const popular = searchParams.get("popular") === "true";
    const tag = searchParams.get("tag");
    const search = searchParams.get("q");
    
    // Build conditions
    const conditions = [eq(galleryBuilds.isActive, true)];
    
    if (make) {
      conditions.push(ilike(galleryBuilds.vehicleMake, make));
    }
    
    if (model) {
      conditions.push(ilike(galleryBuilds.vehicleModel, `%${model}%`));
    }
    
    if (style) {
      conditions.push(eq(galleryBuilds.buildStyle, style));
    }
    
    if (featured) {
      conditions.push(eq(galleryBuilds.isFeatured, true));
    }
    
    if (popular) {
      conditions.push(eq(galleryBuilds.isPopular, true));
    }
    
    if (tag) {
      // Search in JSON array
      conditions.push(sql`${galleryBuilds.tags}::jsonb ? ${tag}`);
    }
    
    if (search) {
      // Full-text search across multiple fields
      conditions.push(or(
        ilike(galleryBuilds.vehicleMake, `%${search}%`),
        ilike(galleryBuilds.vehicleModel, `%${search}%`),
        ilike(galleryBuilds.wheelBrand, `%${search}%`),
        ilike(galleryBuilds.wheelModel, `%${search}%`),
        ilike(galleryBuilds.tireBrand, `%${search}%`),
        ilike(galleryBuilds.tireModel, `%${search}%`),
        ilike(galleryBuilds.title, `%${search}%`),
      )!);
    }
    
    // Query builds
    const builds = await db
      .select()
      .from(galleryBuilds)
      .where(and(...conditions))
      .orderBy(
        desc(galleryBuilds.isFeatured),
        asc(galleryBuilds.displayOrder),
        desc(galleryBuilds.createdAt)
      )
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(galleryBuilds)
      .where(and(...conditions));
    
    const total = Number(countResult[0]?.count || 0);
    
    // Get filter options for sidebar
    const filterOptions = await getFilterOptions();
    
    return NextResponse.json({
      builds,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: filterOptions,
    });
  } catch (error) {
    console.error("[build-gallery] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch builds" },
      { status: 500 }
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// POST: Create new build (admin)
// ════════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = [
      "vehicleYear", "vehicleMake", "vehicleModel",
      "buildStyle", "wheelBrand", "wheelModel", "wheelSize",
      "tireBrand", "tireModel", "tireSize", "heroImageUrl"
    ];
    
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }
    
    // Generate slug if not provided
    const slug = body.slug || generateBuildSlug({
      vehicleYear: body.vehicleYear,
      vehicleMake: body.vehicleMake,
      vehicleModel: body.vehicleModel,
      wheelBrand: body.wheelBrand,
      wheelModel: body.wheelModel,
      tireBrand: body.tireBrand,
      tireModel: body.tireModel,
    });
    
    // Check for slug conflict
    const existing = await db
      .select({ id: galleryBuilds.id })
      .from(galleryBuilds)
      .where(eq(galleryBuilds.slug, slug))
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A build with this slug already exists", slug },
        { status: 409 }
      );
    }
    
    // Insert build
    const [newBuild] = await db
      .insert(galleryBuilds)
      .values({
        slug,
        title: body.title,
        description: body.description,
        vehicleYear: body.vehicleYear,
        vehicleMake: body.vehicleMake,
        vehicleModel: body.vehicleModel,
        vehicleTrim: body.vehicleTrim,
        buildStyle: body.buildStyle,
        liftLevel: body.liftLevel,
        wheelBrand: body.wheelBrand,
        wheelModel: body.wheelModel,
        wheelSize: body.wheelSize,
        wheelFinish: body.wheelFinish,
        wheelOffset: body.wheelOffset,
        wheelBoltPattern: body.wheelBoltPattern,
        wheelSku: body.wheelSku,
        tireBrand: body.tireBrand,
        tireModel: body.tireModel,
        tireSize: body.tireSize,
        tireSku: body.tireSku,
        heroImageUrl: body.heroImageUrl,
        additionalImages: body.additionalImages || [],
        tags: body.tags || [],
        isFeatured: body.isFeatured || false,
        isPopular: body.isPopular || false,
        isActive: body.isActive !== false,
        displayOrder: body.displayOrder || 1000,
        sourceType: body.sourceType,
        sourceAttribution: body.sourceAttribution,
      })
      .returning();
    
    return NextResponse.json({ build: newBuild }, { status: 201 });
  } catch (error) {
    console.error("[build-gallery] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create build" },
      { status: 500 }
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// HELPER: Get filter options
// ════════════════════════════════════════════════════════════════════════════════

async function getFilterOptions() {
  try {
    // Get unique makes with counts
    const makes = await db
      .select({
        value: galleryBuilds.vehicleMake,
        count: sql<number>`count(*)`,
      })
      .from(galleryBuilds)
      .where(eq(galleryBuilds.isActive, true))
      .groupBy(galleryBuilds.vehicleMake)
      .orderBy(desc(sql`count(*)`));
    
    // Get unique styles with counts
    const styles = await db
      .select({
        value: galleryBuilds.buildStyle,
        count: sql<number>`count(*)`,
      })
      .from(galleryBuilds)
      .where(eq(galleryBuilds.isActive, true))
      .groupBy(galleryBuilds.buildStyle)
      .orderBy(desc(sql`count(*)`));
    
    // Get unique wheel brands with counts
    const wheelBrands = await db
      .select({
        value: galleryBuilds.wheelBrand,
        count: sql<number>`count(*)`,
      })
      .from(galleryBuilds)
      .where(eq(galleryBuilds.isActive, true))
      .groupBy(galleryBuilds.wheelBrand)
      .orderBy(desc(sql`count(*)`));
    
    // Get total counts
    const totals = await db
      .select({
        total: sql<number>`count(*)`,
        featured: sql<number>`sum(case when ${galleryBuilds.isFeatured} then 1 else 0 end)`,
        popular: sql<number>`sum(case when ${galleryBuilds.isPopular} then 1 else 0 end)`,
      })
      .from(galleryBuilds)
      .where(eq(galleryBuilds.isActive, true));
    
    return {
      makes: makes.map(m => ({ value: m.value, count: Number(m.count) })),
      styles: styles.map(s => ({ value: s.value, count: Number(s.count) })),
      wheelBrands: wheelBrands.map(w => ({ value: w.value, count: Number(w.count) })),
      totals: {
        total: Number(totals[0]?.total || 0),
        featured: Number(totals[0]?.featured || 0),
        popular: Number(totals[0]?.popular || 0),
      },
    };
  } catch (error) {
    console.error("[build-gallery] getFilterOptions error:", error);
    return {
      makes: [],
      styles: [],
      wheelBrands: [],
      totals: { total: 0, featured: 0, popular: 0 },
    };
  }
}
