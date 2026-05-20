/**
 * Admin Missing Fitment API
 * 
 * Manage vehicles missing from WTD fitment database.
 * 
 * GET /api/admin/missing-fitment
 *   - Query: ?status=new&limit=50&offset=0&sortBy=request_count&sortDir=desc&search=
 *   - Returns: Paginated list of missing fitment requests
 * 
 * GET /api/admin/missing-fitment/stats
 *   - Returns: Summary stats and alerts
 * 
 * GET /api/admin/missing-fitment/alerts
 *   - Returns: Undismissed alerts
 * 
 * PATCH /api/admin/missing-fitment/:id
 *   - Update status, notes
 * 
 * POST /api/admin/missing-fitment/bulk-status
 *   - Bulk update status for multiple IDs
 * 
 * POST /api/admin/missing-fitment/dismiss-alert
 *   - Dismiss an alert
 * 
 * @created 2026-05-20
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getMissingFitmentRequests,
  getMissingFitmentStats,
  updateMissingFitmentStatus,
  bulkUpdateStatus,
  getAlerts,
  dismissAlert,
  dismissAllAlerts,
  type MissingFitmentStatus,
} from "@/lib/fitment/missingFitmentService";
import { verifyAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdminAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  
  try {
    // Stats endpoint
    if (endpoint === "stats") {
      const stats = await getMissingFitmentStats();
      return NextResponse.json(stats);
    }
    
    // Alerts endpoint
    if (endpoint === "alerts") {
      const alerts = await getAlerts(20);
      return NextResponse.json({ alerts });
    }
    
    // Main list endpoint
    const status = searchParams.get("status") as MissingFitmentStatus | "all" || "all";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const sortBy = (searchParams.get("sortBy") || "request_count") as any;
    const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";
    const search = searchParams.get("search") || undefined;
    
    const result = await getMissingFitmentRequests({
      status,
      limit,
      offset,
      sortBy,
      sortDir,
      search,
    });
    
    return NextResponse.json({
      ...result,
      pagination: {
        limit,
        offset,
        hasMore: offset + result.requests.length < result.total,
      },
    });
  } catch (error) {
    console.error("[admin/missing-fitment] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch missing fitment data" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdminAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { id, status, notes } = body;
    
    if (!id || !status) {
      return NextResponse.json(
        { error: "Missing required fields: id, status" },
        { status: 400 }
      );
    }
    
    const validStatuses: MissingFitmentStatus[] = ["new", "reviewed", "added_to_db", "ignored"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }
    
    const success = await updateMissingFitmentStatus(
      id,
      status,
      notes,
      authResult.user || "admin"
    );
    
    if (!success) {
      return NextResponse.json(
        { error: "Failed to update status" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, id, status });
  } catch (error) {
    console.error("[admin/missing-fitment] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update missing fitment request" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdminAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { action } = body;
    
    // Bulk status update
    if (action === "bulk-status") {
      const { ids, status } = body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
        return NextResponse.json(
          { error: "Missing required fields: ids (array), status" },
          { status: 400 }
        );
      }
      
      const updated = await bulkUpdateStatus(ids, status, authResult.user || "admin");
      return NextResponse.json({ success: true, updated });
    }
    
    // Dismiss single alert
    if (action === "dismiss-alert") {
      const { alertId } = body;
      
      if (!alertId) {
        return NextResponse.json(
          { error: "Missing required field: alertId" },
          { status: 400 }
        );
      }
      
      const success = await dismissAlert(alertId);
      return NextResponse.json({ success });
    }
    
    // Dismiss all alerts
    if (action === "dismiss-all-alerts") {
      const success = await dismissAllAlerts();
      return NextResponse.json({ success });
    }
    
    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[admin/missing-fitment] POST error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
