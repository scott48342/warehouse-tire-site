/**
 * Fitment API Admin Endpoints
 * 
 * GET /api/fitment-api/admin - List pending requests
 * POST /api/fitment-api/admin - Approve/reject requests
 * 
 * Protected by admin auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { 
  getPendingRequests, 
  approveAccessRequest, 
  rejectAccessRequest,
  getRequestById,
} from "@/lib/fitment-api/requests";
import { getApiKeyById } from "@/lib/fitment-api/apiKeys";

// Admin auth check (same as other admin routes)
async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin_token");
  return adminToken?.value === process.env.ADMIN_TOKEN;
}

/**
 * GET - List pending API access requests
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    // Get specific request by ID
    if (id) {
      const req = await getRequestById(id);
      if (!req) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }
      
      // Include API key info if approved
      let keyInfo = null;
      if (req.apiKeyId) {
        const key = await getApiKeyById(req.apiKeyId);
        if (key) {
          keyInfo = {
            id: key.id,
            prefix: key.keyPrefix,
            plan: key.plan,
            active: key.active,
            requestCount: key.requestCount,
            firstCallAt: key.firstCallAt,
            lastRequestAt: key.lastRequestAt,
          };
        }
      }
      
      return NextResponse.json({ request: req, apiKey: keyInfo });
    }
    
    // List all pending requests
    const requests = await getPendingRequests();
    return NextResponse.json({ requests, count: requests.length });
    
  } catch (err) {
    console.error("[api/fitment-api/admin] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

/**
 * POST - Approve or reject a request
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { requestId, action, plan, notes } = body;
    
    if (!requestId || !action) {
      return NextResponse.json(
        { error: "requestId and action are required" },
        { status: 400 }
      );
    }
    
    if (action === "approve") {
      const result = await approveAccessRequest(
        requestId,
        "admin", // TODO: Get actual admin user
        plan || "starter",
        notes
      );
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to approve request" },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: "Request approved. API key sent to user.",
        // Don't expose the API key in admin response
      });
      
    } else if (action === "reject") {
      const result = await rejectAccessRequest(
        requestId,
        "admin",
        notes
      );
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to reject request" },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: "Request rejected.",
      });
      
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'approve' or 'reject'." },
        { status: 400 }
      );
    }
    
  } catch (err) {
    console.error("[api/fitment-api/admin] POST error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
