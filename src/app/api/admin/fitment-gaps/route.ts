/**
 * Admin Fitment Gaps API
 * 
 * Provides visibility into missing fitment requests for database enrichment
 * prioritization and lost opportunity tracking.
 * 
 * GET /api/admin/fitment-gaps
 *   - Query: ?days=30&limit=50
 *   - Returns: Top missing vehicles, stats, and trends
 * 
 * GET /api/admin/fitment-gaps?vehicle=Cadillac|DTS|2009
 *   - Returns: Detailed history for a specific vehicle
 * 
 * @created 2026-05-20
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getTopMissingVehicles,
  getGapStats,
  getVehicleGapHistory,
} from "@/lib/analytics/fitmentGapTracker";
import { verifyAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdminAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const vehicle = searchParams.get("vehicle"); // "Make|Model|Year"
  const days = parseInt(searchParams.get("days") || "30", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  
  try {
    // Single vehicle detail view
    if (vehicle) {
      const parts = vehicle.split("|");
      if (parts.length < 2) {
        return NextResponse.json(
          { error: "Invalid vehicle format. Use: Make|Model or Make|Model|Year" },
          { status: 400 }
        );
      }
      
      const [make, model, yearStr] = parts;
      const year = yearStr ? parseInt(yearStr, 10) : undefined;
      
      const history = await getVehicleGapHistory(make, model, year);
      
      return NextResponse.json({
        vehicle: { make, model, year },
        ...history,
      });
    }
    
    // Dashboard view - stats and top missing vehicles
    const [stats, topMissing] = await Promise.all([
      getGapStats(days),
      getTopMissingVehicles(limit, days),
    ]);
    
    return NextResponse.json({
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
      stats,
      topMissingVehicles: topMissing,
      enrichmentPriority: topMissing.slice(0, 10).map(v => ({
        vehicle: `${v.year} ${v.make} ${v.model}`,
        requests: v.requestCount,
        potential: v.searchAttempts > 0 
          ? `${Math.round(v.cartCreated / v.searchAttempts * 100)}% cart conversion on searches`
          : "No search data yet",
        recommendation: getEnrichmentRecommendation(v),
      })),
    });
  } catch (error) {
    console.error("[admin/fitment-gaps] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fitment gap data" },
      { status: 500 }
    );
  }
}

function getEnrichmentRecommendation(summary: any): string {
  if (summary.requestCount >= 10 && summary.fallbackSuccessRate < 50) {
    return "🔴 HIGH PRIORITY - High demand, low fallback success";
  }
  if (summary.requestCount >= 5 && summary.cartCreated > 0) {
    return "🟠 MEDIUM PRIORITY - Proven conversion potential";
  }
  if (summary.requestCount >= 3) {
    return "🟡 LOW PRIORITY - Moderate demand";
  }
  return "⚪ MONITOR - Low volume, keep watching";
}
