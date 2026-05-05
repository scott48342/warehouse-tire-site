/**
 * Admin API: Wheel-Size Trim Mappings
 * 
 * CRUD operations for reviewing and managing trim mappings.
 * Admin-only endpoint - requires authentication.
 * 
 * NO REGRESSION RULES:
 * - Do not modify customer-facing trim/submodel labels
 * - Do not expose Wheel-Size engine labels as trims
 * - Approved mappings only control OEM package chooser behavior
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { wheelSizeTrimMappings } from "@/lib/fitment-db/schema";
import { eq, and, ilike, desc, asc, sql, or } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

interface ListParams {
  status?: string;
  confidence?: string;
  needsReview?: boolean;
  year?: number;
  make?: string;
  model?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface ApproveParams {
  id: string;
  reviewedBy: string;
  notes?: string;
}

interface RejectParams {
  id: string;
  reviewedBy: string;
  reason: string;
}

interface UpdateNotesParams {
  id: string;
  notes: string;
  reviewedBy: string;
}

// ============================================================================
// GET - List mappings with filters
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params: ListParams = {
      status: searchParams.get("status") || undefined,
      confidence: searchParams.get("confidence") || undefined,
      needsReview: searchParams.get("needsReview") === "true" ? true : undefined,
      year: searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined,
      make: searchParams.get("make") || undefined,
      model: searchParams.get("model") || undefined,
      search: searchParams.get("search") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: Math.min(parseInt(searchParams.get("limit") || "50"), 100),
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
    };
    
    // Build conditions
    const conditions = [];
    
    if (params.status) {
      conditions.push(eq(wheelSizeTrimMappings.status, params.status));
    }
    
    if (params.confidence) {
      conditions.push(eq(wheelSizeTrimMappings.matchConfidence, params.confidence));
    }
    
    if (params.needsReview !== undefined) {
      conditions.push(eq(wheelSizeTrimMappings.needsReview, params.needsReview));
    }
    
    if (params.year) {
      conditions.push(eq(wheelSizeTrimMappings.year, params.year));
    }
    
    if (params.make) {
      conditions.push(ilike(wheelSizeTrimMappings.make, `%${params.make}%`));
    }
    
    if (params.model) {
      conditions.push(ilike(wheelSizeTrimMappings.model, `%${params.model}%`));
    }
    
    if (params.search) {
      conditions.push(
        or(
          ilike(wheelSizeTrimMappings.make, `%${params.search}%`),
          ilike(wheelSizeTrimMappings.model, `%${params.search}%`),
          ilike(wheelSizeTrimMappings.ourTrim, `%${params.search}%`),
          ilike(wheelSizeTrimMappings.wsTrim, `%${params.search}%`)
        )
      );
    }
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(wheelSizeTrimMappings)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = Number(countResult[0]?.count || 0);
    
    // Get mappings with pagination
    const offset = ((params.page || 1) - 1) * (params.limit || 50);
    
    const sortColumn = params.sortBy === "reviewedAt" 
      ? wheelSizeTrimMappings.reviewedAt
      : params.sortBy === "year"
      ? wheelSizeTrimMappings.year
      : params.sortBy === "make"
      ? wheelSizeTrimMappings.make
      : params.sortBy === "confidence"
      ? wheelSizeTrimMappings.matchConfidence
      : params.sortBy === "status"
      ? wheelSizeTrimMappings.status
      : wheelSizeTrimMappings.createdAt;
    
    const mappings = await db
      .select()
      .from(wheelSizeTrimMappings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(params.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(params.limit || 50)
      .offset(offset);
    
    // Add warnings for engine-based matches
    const mappingsWithWarnings = mappings.map(m => {
      const warnings: string[] = [];
      
      // Check for engine-based naming (looks like engine spec)
      if (m.wsTrim && /^\d+\.\d+[ilLvV]?$/.test(m.wsTrim)) {
        warnings.push("Wheel-Size appears to use engine/package naming. Do not treat this as a customer-facing trim.");
      }
      
      if (m.wsEngine && m.wsTrim === m.wsEngine) {
        warnings.push("Wheel-Size trim matches engine field - likely engine-based, not trim-based.");
      }
      
      // Check for low confidence
      if (m.matchConfidence === "low") {
        warnings.push("Low confidence match - requires manual verification before runtime use.");
      }
      
      // Check for multiple configs
      const configCount = m.configCount || 0;
      if (configCount > 1) {
        warnings.push(`${configCount} factory package options exist. Show as wheel/tire choices, not submodels.`);
      }
      
      return {
        ...m,
        warnings,
      };
    });
    
    // Get summary stats
    const stats = await db
      .select({
        status: wheelSizeTrimMappings.status,
        count: sql<number>`count(*)`,
      })
      .from(wheelSizeTrimMappings)
      .groupBy(wheelSizeTrimMappings.status);
    
    const confidenceStats = await db
      .select({
        confidence: wheelSizeTrimMappings.matchConfidence,
        count: sql<number>`count(*)`,
      })
      .from(wheelSizeTrimMappings)
      .groupBy(wheelSizeTrimMappings.matchConfidence);
    
    const needsReviewCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(wheelSizeTrimMappings)
      .where(eq(wheelSizeTrimMappings.needsReview, true));
    
    return NextResponse.json({
      mappings: mappingsWithWarnings,
      pagination: {
        page: params.page || 1,
        limit: params.limit || 50,
        total,
        totalPages: Math.ceil(total / (params.limit || 50)),
      },
      stats: {
        byStatus: Object.fromEntries(stats.map(s => [s.status, Number(s.count)])),
        byConfidence: Object.fromEntries(confidenceStats.map(s => [s.confidence, Number(s.count)])),
        needsReview: Number(needsReviewCount[0]?.count || 0),
      },
    });
    
  } catch (error) {
    console.error("[admin/trim-mappings] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trim mappings" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Actions (approve, reject, update notes)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case "approve": {
        const { id, reviewedBy, notes } = body as ApproveParams & { action: string };
        
        if (!id || !reviewedBy) {
          return NextResponse.json(
            { error: "Missing required fields: id, reviewedBy" },
            { status: 400 }
          );
        }
        
        // Get the mapping first to check confidence
        const [existing] = await db
          .select()
          .from(wheelSizeTrimMappings)
          .where(eq(wheelSizeTrimMappings.id, id))
          .limit(1);
        
        if (!existing) {
          return NextResponse.json(
            { error: "Mapping not found" },
            { status: 404 }
          );
        }
        
        // Warn if approving low confidence
        if (existing.matchConfidence === "low") {
          console.warn(`[admin/trim-mappings] Approving LOW confidence mapping: ${id}`);
        }
        
        await db
          .update(wheelSizeTrimMappings)
          .set({
            status: "approved",
            needsReview: false,
            reviewedBy,
            reviewedAt: new Date(),
            reviewNotes: notes || null,
            updatedAt: new Date(),
          })
          .where(eq(wheelSizeTrimMappings.id, id));
        
        return NextResponse.json({ success: true, action: "approved" });
      }
      
      case "reject": {
        const { id, reviewedBy, reason } = body as RejectParams & { action: string };
        
        if (!id || !reviewedBy || !reason) {
          return NextResponse.json(
            { error: "Missing required fields: id, reviewedBy, reason" },
            { status: 400 }
          );
        }
        
        await db
          .update(wheelSizeTrimMappings)
          .set({
            status: "rejected",
            needsReview: false,
            reviewedBy,
            reviewedAt: new Date(),
            reviewReason: reason,
            reviewNotes: reason,
            updatedAt: new Date(),
          })
          .where(eq(wheelSizeTrimMappings.id, id));
        
        return NextResponse.json({ success: true, action: "rejected" });
      }
      
      case "updateNotes": {
        const { id, notes, reviewedBy } = body as UpdateNotesParams & { action: string };
        
        if (!id) {
          return NextResponse.json(
            { error: "Missing required field: id" },
            { status: 400 }
          );
        }
        
        await db
          .update(wheelSizeTrimMappings)
          .set({
            reviewNotes: notes,
            reviewedBy: reviewedBy || undefined,
            updatedAt: new Date(),
          })
          .where(eq(wheelSizeTrimMappings.id, id));
        
        return NextResponse.json({ success: true, action: "notesUpdated" });
      }
      
      case "markNeedsReview": {
        const { id, reviewedBy, reason } = body;
        
        if (!id) {
          return NextResponse.json(
            { error: "Missing required field: id" },
            { status: 400 }
          );
        }
        
        await db
          .update(wheelSizeTrimMappings)
          .set({
            status: "needs_manual",
            needsReview: true,
            reviewReason: reason || "Marked for manual review",
            reviewedBy: reviewedBy || null,
            updatedAt: new Date(),
          })
          .where(eq(wheelSizeTrimMappings.id, id));
        
        return NextResponse.json({ success: true, action: "markedForReview" });
      }
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error("[admin/trim-mappings] POST error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
