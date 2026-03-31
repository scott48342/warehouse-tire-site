import { NextResponse } from "next/server";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// This admin endpoint is DISABLED. Trim refresh must use bulk-import scripts.
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/fitment/refresh-trims - DISABLED
 * 
 * This endpoint previously called Wheel-Size API for batch trim updates.
 * In DB-first architecture, use bulk-import scripts instead.
 */
export async function POST(_req: Request) {
  console.warn("[refresh-trims] DISABLED: Wheel-Size API is forbidden (DB-first mode)");
  
  return NextResponse.json({
    error: "Wheel-Size API is permanently disabled (DB-first architecture)",
    disabled: true,
    migration: "Use bulk-import scripts for trim data updates",
  }, { status: 410 }); // 410 Gone
}

/**
 * GET - Endpoint disabled
 */
export async function GET(_req: Request) {
  return NextResponse.json({
    error: "Wheel-Size API is permanently disabled (DB-first architecture)",
    disabled: true,
    migration: "Use bulk-import scripts for trim data updates",
  }, { status: 410 }); // 410 Gone
}
