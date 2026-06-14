/**
 * Build Gallery Single Build API
 * 
 * GET /api/build-gallery/[slug] - Get single build by slug
 * PUT /api/build-gallery/[slug] - Update build (admin)
 * DELETE /api/build-gallery/[slug] - Delete build (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/client";
import { galleryBuilds, buildToJakeContext } from "@/lib/fitment-db/schema";
import { eq, and, ne } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// ════════════════════════════════════════════════════════════════════════════════
// GET: Get single build with Jake context
// ════════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    
    const [build] = await db
      .select()
      .from(galleryBuilds)
      .where(and(
        eq(galleryBuilds.slug, slug),
        eq(galleryBuilds.isActive, true)
      ))
      .limit(1);
    
    if (!build) {
      return NextResponse.json(
        { error: "Build not found" },
        { status: 404 }
      );
    }
    
    // Generate Jake context for "Build Something Similar" CTA
    const jakeContext = buildToJakeContext(build);
    
    // Get related builds (same make/model or style)
    const related = await db
      .select()
      .from(galleryBuilds)
      .where(and(
        eq(galleryBuilds.isActive, true),
        ne(galleryBuilds.id, build.id)
      ))
      .limit(6);
    
    return NextResponse.json({
      build,
      jakeContext,
      related,
    });
  } catch (error) {
    console.error("[build-gallery] GET single error:", error);
    return NextResponse.json(
      { error: "Failed to fetch build" },
      { status: 500 }
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// PUT: Update build (admin)
// ════════════════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const body = await request.json();
    
    // Find existing build
    const [existing] = await db
      .select()
      .from(galleryBuilds)
      .where(eq(galleryBuilds.slug, slug))
      .limit(1);
    
    if (!existing) {
      return NextResponse.json(
        { error: "Build not found" },
        { status: 404 }
      );
    }
    
    // If slug is being changed, check for conflicts
    if (body.slug && body.slug !== slug) {
      const [conflict] = await db
        .select({ id: galleryBuilds.id })
        .from(galleryBuilds)
        .where(eq(galleryBuilds.slug, body.slug))
        .limit(1);
      
      if (conflict) {
        return NextResponse.json(
          { error: "A build with this slug already exists" },
          { status: 409 }
        );
      }
    }
    
    // Update build
    const [updated] = await db
      .update(galleryBuilds)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(galleryBuilds.id, existing.id))
      .returning();
    
    return NextResponse.json({ build: updated });
  } catch (error) {
    console.error("[build-gallery] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update build" },
      { status: 500 }
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// DELETE: Delete build (admin)
// ════════════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    
    // Soft delete (set isActive = false) or hard delete based on query param
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hard") === "true";
    
    if (hardDelete) {
      const result = await db
        .delete(galleryBuilds)
        .where(eq(galleryBuilds.slug, slug))
        .returning({ id: galleryBuilds.id });
      
      if (result.length === 0) {
        return NextResponse.json(
          { error: "Build not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ deleted: true, id: result[0].id });
    } else {
      // Soft delete
      const [updated] = await db
        .update(galleryBuilds)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(galleryBuilds.slug, slug))
        .returning();
      
      if (!updated) {
        return NextResponse.json(
          { error: "Build not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ deleted: false, deactivated: true, build: updated });
    }
  } catch (error) {
    console.error("[build-gallery] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete build" },
      { status: 500 }
    );
  }
}
