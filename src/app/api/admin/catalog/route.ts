/**
 * Admin: Catalog Management
 * 
 * GET /api/admin/catalog - Get catalog stats
 * POST /api/admin/catalog - Populate catalog from Wheel-Size API
 */

import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for full population

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
    switch (action) {
      case "populate-makes": {
        const count = await catalogStore.populateMakes();
        return NextResponse.json({ success: true, makes: count });
      }
      
      case "populate-models": {
        const makeSlug = body.make;
        if (!makeSlug) {
          return NextResponse.json({ error: "Missing 'make' parameter" }, { status: 400 });
        }
        const count = await catalogStore.populateModels(makeSlug);
        return NextResponse.json({ success: true, make: makeSlug, models: count });
      }
      
      case "populate-common": {
        const result = await catalogStore.populateCommonMakes();
        return NextResponse.json({ success: true, ...result });
      }
      
      case "clear": {
        await catalogStore.clearCatalog();
        return NextResponse.json({ success: true, message: "Catalog cleared" });
      }
      
      case "stats": {
        const stats = await catalogStore.getStats();
        return NextResponse.json(stats);
      }
      
      default:
        return NextResponse.json({ 
          error: "Unknown action",
          receivedAction: action,
          validActions: ["populate-makes", "populate-models", "populate-common", "clear", "stats"]
        }, { status: 400 });
    }
  } catch (err: any) {
    console.error(`[admin/catalog] Error:`, err);
    return NextResponse.json({ 
      error: err?.message || "Operation failed",
      action,
    }, { status: 500 });
  }
}
