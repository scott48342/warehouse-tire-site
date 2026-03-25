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
  const stats = catalogStore.getStats();
  return NextResponse.json(stats);
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e: any) {
    return NextResponse.json({ 
      error: "Failed to parse JSON body",
      message: e?.message,
      contentType: req.headers.get("content-type"),
    }, { status: 400 });
  }
  
  const action = body.action;
  
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
      // Populate common US makes with models and years
      const result = await catalogStore.populateCommonMakes();
      return NextResponse.json({ success: true, ...result });
    }
    
    case "populate-modifications": {
      const { year, make, model } = body;
      if (!year || !make || !model) {
        return NextResponse.json({ error: "Missing year, make, or model" }, { status: 400 });
      }
      const count = await catalogStore.populateModifications(year, make, model);
      return NextResponse.json({ success: true, modifications: count });
    }
    
    case "clear": {
      catalogStore.clearCatalog();
      return NextResponse.json({ success: true, message: "Catalog cleared" });
    }
    
    default:
      return NextResponse.json({ 
        error: "Unknown action",
        receivedAction: action,
        receivedBody: body,
        validActions: ["populate-makes", "populate-models", "populate-common", "populate-modifications", "clear"]
      }, { status: 400 });
  }
}
