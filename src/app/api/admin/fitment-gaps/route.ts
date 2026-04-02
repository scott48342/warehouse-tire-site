/**
 * Admin API: Fitment Gap Report
 * 
 * GET /api/admin/fitment-gaps
 * 
 * Returns comprehensive reports on unresolved fitment searches.
 * Helps prioritize which vehicles to add to the fitment database.
 * 
 * Query params:
 * - report: "summary" | "top" | "recent" | "makes" | "models" | "daily" | "priority" (default: "summary")
 * - limit: number (default: 50)
 * - searchType: "wheel" | "tire" | "fitment" | "unknown"
 * - make: string (for models report)
 * - days: number (for filtering by recency)
 * - minCount: number (minimum occurrence count)
 */

import { NextResponse } from "next/server";
import {
  getTopUnresolvedVehicles,
  getRecentUnresolvedVehicles,
  getUnresolvedCountsByMake,
  getUnresolvedCountsByModel,
  getUnresolvedDailyCounts,
  getHighValueGaps,
  getUnresolvedSummary,
  markVehicleResolved,
} from "@/lib/fitment-db/unresolvedFitmentTracker";
import { getAlertConfig, getAlertHistory } from "@/lib/fitment-db/gapAlerts";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const report = url.searchParams.get("report") || "summary";
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || "50")));
    const searchType = url.searchParams.get("searchType") as "wheel" | "tire" | "fitment" | "unknown" | null;
    const make = url.searchParams.get("make");
    const days = url.searchParams.get("days") ? Number(url.searchParams.get("days")) : undefined;
    const minCount = url.searchParams.get("minCount") ? Number(url.searchParams.get("minCount")) : undefined;

    switch (report) {
      case "summary": {
        const summary = await getUnresolvedSummary();
        const topVehicles = await getTopUnresolvedVehicles({ limit: 10 });
        const topMakes = await getUnresolvedCountsByMake({ limit: 10 });
        const priority = await getHighValueGaps({ limit: 5 });
        const alertConfig = getAlertConfig();
        
        return NextResponse.json({
          success: true,
          report: "summary",
          data: {
            summary,
            topVehicles: topVehicles.map(v => ({
              vehicle: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`,
              searches: v.occurrenceCount,
              type: v.searchType,
              lastSeen: v.lastSeen,
            })),
            topMakes: topMakes.map(m => ({
              make: m.make,
              vehicles: m.vehicleCount,
              searches: m.totalSearches,
            })),
            highPriority: priority.map(v => ({
              vehicle: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`,
              searches: v.occurrenceCount,
              priorityScore: v.priorityScore,
              daysAgo: v.daysSinceLastSeen,
            })),
          },
          alerting: {
            enabled: alertConfig.enabled,
            threshold: alertConfig.threshold,
            cooldownHours: alertConfig.cooldownHours,
            highPriorityScore: alertConfig.highPriorityScore,
            recipientConfigured: !!alertConfig.recipientEmail,
          },
          description: "Overview of unresolved fitment searches",
        });
      }

      case "top": {
        const vehicles = await getTopUnresolvedVehicles({
          limit,
          searchType: searchType || undefined,
          minCount,
          sinceDays: days,
        });
        
        return NextResponse.json({
          success: true,
          report: "top",
          count: vehicles.length,
          vehicles: vehicles.map(v => ({
            year: v.year,
            make: v.make,
            model: v.model,
            trim: v.trim,
            searchType: v.searchType,
            occurrenceCount: v.occurrenceCount,
            firstSeen: v.firstSeen,
            lastSeen: v.lastSeen,
            daysSinceLastSeen: v.daysSinceLastSeen,
            samplePaths: v.metadata?.samplePaths,
          })),
          description: "Top unresolved vehicles by search count",
        });
      }

      case "recent": {
        const vehicles = await getRecentUnresolvedVehicles({
          limit,
          sinceDays: days || 7,
        });
        
        return NextResponse.json({
          success: true,
          report: "recent",
          count: vehicles.length,
          vehicles: vehicles.map(v => ({
            year: v.year,
            make: v.make,
            model: v.model,
            trim: v.trim,
            searchType: v.searchType,
            occurrenceCount: v.occurrenceCount,
            firstSeen: v.firstSeen,
            lastSeen: v.lastSeen,
          })),
          description: `Recently searched unresolved vehicles (last ${days || 7} days)`,
        });
      }

      case "makes": {
        const makes = await getUnresolvedCountsByMake({
          limit,
          sinceDays: days,
        });
        
        return NextResponse.json({
          success: true,
          report: "makes",
          count: makes.length,
          makes,
          description: "Unresolved searches grouped by make",
        });
      }

      case "models": {
        if (!make) {
          return NextResponse.json(
            { success: false, error: "Missing required param: make" },
            { status: 400 }
          );
        }
        
        const models = await getUnresolvedCountsByModel(make, {
          limit,
          sinceDays: days,
        });
        
        return NextResponse.json({
          success: true,
          report: "models",
          make,
          count: models.length,
          models,
          description: `Unresolved searches for ${make} grouped by model`,
        });
      }

      case "daily": {
        const dailyCounts = await getUnresolvedDailyCounts({
          days: days || 30,
        });
        
        return NextResponse.json({
          success: true,
          report: "daily",
          days: days || 30,
          counts: dailyCounts,
          description: "Daily counts of new unresolved vehicles",
        });
      }

      case "priority": {
        const priority = await getHighValueGaps({
          limit,
          minCount: minCount || 3,
          recentDays: days || 14,
        });
        
        return NextResponse.json({
          success: true,
          report: "priority",
          count: priority.length,
          vehicles: priority.map(v => ({
            year: v.year,
            make: v.make,
            model: v.model,
            trim: v.trim,
            searchType: v.searchType,
            occurrenceCount: v.occurrenceCount,
            priorityScore: v.priorityScore,
            daysSinceLastSeen: v.daysSinceLastSeen,
            firstSeen: v.firstSeen,
            lastSeen: v.lastSeen,
          })),
          description: "High-priority gaps (frequent + recent)",
        });
      }

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: `Unknown report type: ${report}`,
            validReports: ["summary", "top", "recent", "makes", "models", "daily", "priority"],
          },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[admin/fitment-gaps] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/fitment-gaps
 * 
 * Marks a vehicle as resolved (removes from tracking).
 * Call this after adding fitment data for a vehicle.
 * 
 * Body: { year: number, make: string, model: string, trim?: string }
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { year, make, model, trim } = body;
    
    if (!year || !make || !model) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: year, make, model" },
        { status: 400 }
      );
    }
    
    const deleted = await markVehicleResolved(Number(year), make, model, trim);
    
    return NextResponse.json({
      success: true,
      message: `Marked ${year} ${make} ${model}${trim ? ` ${trim}` : ""} as resolved`,
      recordsDeleted: deleted,
    });
  } catch (err: any) {
    console.error("[admin/fitment-gaps] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
