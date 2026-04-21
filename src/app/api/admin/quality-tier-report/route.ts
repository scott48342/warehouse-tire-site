/**
 * Quality Tier Report API
 * 
 * Phase 5: Reporting
 * Returns stats on data quality tiers and fallback usage.
 */

import { NextResponse } from "next/server";
import { getQualityTierReport } from "@/lib/fitment-db/getFitment";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const report = await getQualityTierReport();
    
    const { overall, byMake, topMissingComplete } = report;
    
    // Calculate percentages
    const pctComplete = ((overall.complete / overall.total) * 100).toFixed(1);
    const pctPartial = ((overall.partial / overall.total) * 100).toFixed(1);
    const pctLowConfidence = ((overall.low_confidence / overall.total) * 100).toFixed(1);
    
    return NextResponse.json({
      summary: {
        total: overall.total,
        complete: {
          count: overall.complete,
          percentage: pctComplete,
          description: "Has wheel specs + tire sizes - safe for wheel search",
        },
        partial: {
          count: overall.partial,
          percentage: pctPartial,
          description: "Has tire sizes only - safe for tire search",
        },
        low_confidence: {
          count: overall.low_confidence,
          percentage: pctLowConfidence,
          description: "Missing data or from unreliable source - avoided",
        },
      },
      queryRules: {
        wheel_search: "Only 'complete' tier records",
        tire_search: "'complete' + 'partial' tier records",
        package_build: "Only 'complete' tier records",
        staggered_detection: "Only 'complete' tier with front/rear position data",
      },
      byMake: byMake.slice(0, 20), // Top 20 makes
      topMissingComplete: topMissingComplete.slice(0, 30), // Top 30 vehicles
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("[quality-tier-report] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
