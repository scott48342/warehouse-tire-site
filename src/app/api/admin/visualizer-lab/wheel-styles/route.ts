/**
 * Wheel Style Assets API
 * 
 * GET: List wheel styles with classification status
 * POST: Manually update a wheel style's classification
 * 
 * NO REGRESSION: Admin/lab API only
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb } from "@/lib/visualizer/db";
import { wheelStyleAssets } from "@/lib/visualizer/schema";
import { eq, desc, isNull, and, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // pending, usable, needs_normalization, rejected
  const frontFacing = url.searchParams.get("frontFacing"); // true, false
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
  const offset = parseInt(url.searchParams.get("offset") || "0");
  
  try {
    let query = visualizerDb.select().from(wheelStyleAssets);
    
    const conditions = [];
    if (status) {
      conditions.push(eq(wheelStyleAssets.visualizerStatus, status));
    }
    if (frontFacing === "true") {
      conditions.push(eq(wheelStyleAssets.isFrontFacing, true));
    } else if (frontFacing === "false") {
      conditions.push(eq(wheelStyleAssets.isFrontFacing, false));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const results = await query
      .orderBy(desc(wheelStyleAssets.updatedAt))
      .limit(limit)
      .offset(offset);
    
    // Get counts
    const [totalCount] = await visualizerDb
      .select({ count: count() })
      .from(wheelStyleAssets);
    
    const [usableCount] = await visualizerDb
      .select({ count: count() })
      .from(wheelStyleAssets)
      .where(and(
        eq(wheelStyleAssets.isFrontFacing, true),
        eq(wheelStyleAssets.visualizerStatus, "usable")
      ));
    
    const [pendingCount] = await visualizerDb
      .select({ count: count() })
      .from(wheelStyleAssets)
      .where(eq(wheelStyleAssets.visualizerStatus, "pending"));
    
    return NextResponse.json({
      styles: results,
      pagination: { limit, offset },
      counts: {
        total: Number(totalCount?.count || 0),
        usable: Number(usableCount?.count || 0),
        pending: Number(pendingCount?.count || 0),
      },
    });
    
  } catch (error) {
    console.error("[wheel-styles] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wheel styles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { styleKey, isFrontFacing, visualizerStatus, normalizedImageUrl, notes } = body;
    
    if (!styleKey) {
      return NextResponse.json({ error: "styleKey is required" }, { status: 400 });
    }
    
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    if (typeof isFrontFacing === "boolean") {
      updateData.isFrontFacing = isFrontFacing;
      updateData.classifiedAt = new Date();
      updateData.classifiedBy = "manual";
    }
    
    if (visualizerStatus) {
      updateData.visualizerStatus = visualizerStatus;
    }
    
    if (normalizedImageUrl !== undefined) {
      updateData.normalizedImageUrl = normalizedImageUrl;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    const [updated] = await visualizerDb
      .update(wheelStyleAssets)
      .set(updateData)
      .where(eq(wheelStyleAssets.styleKey, styleKey))
      .returning();
    
    if (!updated) {
      return NextResponse.json({ error: "Style not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, style: updated });
    
  } catch (error) {
    console.error("[wheel-styles] POST error:", error);
    return NextResponse.json(
      { error: "Failed to update wheel style" },
      { status: 500 }
    );
  }
}
