import { NextResponse } from "next/server";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// This endpoint is DEPRECATED. Use /api/wheels/fitment-search instead.
// ============================================================================

export const runtime = "nodejs";

/**
 * GET /api/vehicles/search - DEPRECATED
 * 
 * This endpoint previously called Wheel-Size API directly.
 * In DB-first architecture, use /api/wheels/fitment-search instead.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  console.warn(`[vehicles/search] DEPRECATED: ${year} ${make} ${model} - Wheel-Size API is forbidden (DB-first mode). Use /api/wheels/fitment-search instead.`);
  
  return NextResponse.json({
    fitment: null,
    error: "This endpoint is deprecated. Wheel-Size API is forbidden in DB-first architecture.",
    deprecated: true,
    migration: "Use /api/wheels/fitment-search instead for vehicle fitment data",
  }, { status: 410 }); // 410 Gone - resource no longer available
}
