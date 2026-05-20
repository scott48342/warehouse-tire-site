/**
 * Admin API: Researched Fitment Cache
 * 
 * Endpoints for viewing and managing cached AI-researched fitment data.
 * 
 * GET  /api/admin/researched-fitment-cache
 *      ?action=stats         - Get cache statistics
 *      ?action=list          - List cached profiles
 *      ?status=active|stale|promoted|rejected
 *      ?staleOnly=true       - Only show stale entries
 *      ?minUseCount=5        - Filter by minimum use count
 *      ?limit=50&offset=0    - Pagination
 * 
 * POST /api/admin/researched-fitment-cache
 *      { action: "promote", id: 123, promotedBy: "admin@example.com" }
 *      { action: "reject", id: 123, rejectedBy: "admin@example.com", reason: "..." }
 *      { action: "refresh", id: 123 }
 *      { action: "delete", id: 123 }
 * 
 * @created 2026-05-20
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCacheStats,
  listCachedProfiles,
  promoteProfile,
  rejectProfile,
  markForRefresh,
  deleteCachedProfile,
  getStaleProfiles,
  type CacheStatus,
} from "@/lib/fitment/researchedFitmentCache";

export const dynamic = "force-dynamic";

// =============================================================================
// GET - Stats & List
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "stats";
    
    if (action === "stats") {
      const stats = await getCacheStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }
    
    if (action === "list") {
      const status = searchParams.get("status") as CacheStatus | null;
      const staleOnly = searchParams.get("staleOnly") === "true";
      const minUseCount = searchParams.get("minUseCount");
      const limit = parseInt(searchParams.get("limit") || "50", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);
      
      const profiles = await listCachedProfiles({
        status: status || undefined,
        staleOnly,
        minUseCount: minUseCount ? parseInt(minUseCount, 10) : undefined,
        limit,
        offset,
      });
      
      return NextResponse.json({
        success: true,
        count: profiles.length,
        profiles,
      });
    }
    
    if (action === "stale") {
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const staleProfiles = await getStaleProfiles(limit);
      
      return NextResponse.json({
        success: true,
        count: staleProfiles.length,
        profiles: staleProfiles,
      });
    }
    
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[admin/researched-fitment-cache] GET error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Admin Actions
// =============================================================================

interface PostBody {
  action: "promote" | "reject" | "refresh" | "delete";
  id: number;
  promotedBy?: string;
  rejectedBy?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PostBody = await request.json();
    const { action, id } = body;
    
    if (!id || typeof id !== "number") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid id" },
        { status: 400 }
      );
    }
    
    switch (action) {
      case "promote": {
        const promotedBy = body.promotedBy || "admin";
        const result = await promoteProfile(id, promotedBy);
        return NextResponse.json(result);
      }
      
      case "reject": {
        const rejectedBy = body.rejectedBy || "admin";
        const reason = body.reason || "No reason provided";
        const result = await rejectProfile(id, rejectedBy, reason);
        return NextResponse.json(result);
      }
      
      case "refresh": {
        const result = await markForRefresh(id);
        return NextResponse.json(result);
      }
      
      case "delete": {
        const result = await deleteCachedProfile(id);
        return NextResponse.json(result);
      }
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[admin/researched-fitment-cache] POST error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
