/**
 * Cache Stats API
 * 
 * GET /api/admin/cache/stats
 * 
 * Returns cache statistics for diagnostics.
 */

import { NextResponse } from "next/server";
import { getYMMCacheStats } from "@/lib/fitment-db/ymmCache";
import { getFitmentCacheStats } from "@/lib/fitment-db/fitmentCache";
import { getSharedCacheStats } from "@/lib/sharedCache";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ymmStats = getYMMCacheStats();
    const fitmentStats = getFitmentCacheStats();
    const availabilityStats = getSharedCacheStats();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ymm: ymmStats,
      fitment: fitmentStats,
      availability: availabilityStats,
      summary: {
        totalHits: ymmStats.hits + fitmentStats.hits + availabilityStats.hits,
        totalMisses: ymmStats.misses + fitmentStats.misses + availabilityStats.misses,
        totalErrors: ymmStats.errors + fitmentStats.errors + availabilityStats.errors,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || "Failed to get cache stats",
    }, { status: 500 });
  }
}
