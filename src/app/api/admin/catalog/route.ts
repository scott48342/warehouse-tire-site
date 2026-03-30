/**
 * Admin: Catalog Management (DB-Only)
 * 
 * GET /api/admin/catalog - Get catalog stats
 * POST /api/admin/catalog - Manage catalog data
 * 
 * NOTE: External Wheel-Size API has been removed.
 * Catalog data must be imported from static sources.
 */

import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for operations

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

  try {
    let result: any;
    
    switch (action) {
      case "clear": {
        await catalogStore.clearCatalog();
        result = { success: true, message: "Catalog cleared" };
        break;
      }
      
      case "stats": {
        const stats = await catalogStore.getStats();
        result = stats;
        break;
      }
      
      // Population actions are disabled - use static data import instead
      case "populate-makes":
      case "populate-models":
      case "populate-common": {
        return NextResponse.json({
          error: "External API population is disabled",
          message: "Use static data import tools instead. Wheel-Size API has been removed.",
          action,
        }, { status: 400 });
      }
      
      default:
        return NextResponse.json({ 
          error: "Unknown action",
          receivedAction: action,
          validActions: ["clear", "stats"],
          deprecatedActions: ["populate-makes", "populate-models", "populate-common"],
          note: "External API population has been removed. Use static data import instead.",
        }, { status: 400 });
    }
    
    return NextResponse.json(result);
    
  } catch (err: any) {
    console.error(`[admin/catalog] Error:`, err);
    return NextResponse.json({ 
      error: err?.message || "Operation failed",
      action,
    }, { status: 500 });
  }
}
