/**
 * Admin: Catalog Management - PARTIALLY DISABLED (Phase A - DB-First Architecture)
 * 
 * GET /api/admin/catalog - Get catalog stats (still works)
 * POST /api/admin/catalog - Populate catalog - DISABLED (Wheel-Size API forbidden)
 * 
 * Use bulk-import scripts for catalog population.
 */

import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// Batch population endpoints are disabled. Use bulk-import scripts.
// ============================================================================

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = await catalogStore.getStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to get stats" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e: any) {
    return NextResponse.json({ 
      error: "Failed to parse JSON body",
      message: e?.message,
    }, { status: 400 });
  }
  
  const action = body.action;

  // Safe actions that don't call external APIs
  const safeModeActions = ["stats", "clear"];
  
  // Batch actions that would call Wheel-Size API - now DISABLED
  const batchActions = ["populate-makes", "populate-models", "populate-common"];

  try {
    if (batchActions.includes(action)) {
      console.warn(`[admin/catalog] Action "${action}" DISABLED - Wheel-Size API is forbidden`);
      return NextResponse.json({
        error: "Wheel-Size API is permanently disabled (DB-first architecture)",
        disabled: true,
        migration: "Use bulk-import scripts for catalog population",
      }, { status: 410 }); // 410 Gone
    }

    switch (action) {
      case "stats":
        const stats = await catalogStore.getStats();
        return NextResponse.json(stats);
        
      case "clear":
        await catalogStore.clearCatalog();
        return NextResponse.json({ success: true, message: "Catalog cleared" });
        
      default:
        return NextResponse.json({ 
          error: `Unknown action: ${action}`,
          availableActions: [...safeModeActions],
          disabledActions: batchActions,
        }, { status: 400 });
    }
  } catch (err: any) {
    console.error(`[admin/catalog] Error:`, err);
    return NextResponse.json({
      error: err?.message || "Operation failed",
    }, { status: 500 });
  }
}
