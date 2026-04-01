/**
 * Admin Analytics Pages Report API
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { sql, gte, desc, count, countDistinct, min, max } from "drizzle-orm";
import { ensureAnalyticsTables } from "@/lib/analytics/track";

export async function GET(request: NextRequest) {
  try {
    await ensureAnalyticsTables();

    const days = parseInt(request.nextUrl.searchParams.get("days") || "7");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Pages report with views, unique sessions, first/last seen
    const pages = await analyticsDb
      .select({
        path: schema.analyticsPageviews.path,
        views: count(),
        uniqueSessions: countDistinct(schema.analyticsPageviews.sessionId),
        firstViewed: min(schema.analyticsPageviews.timestamp),
        lastViewed: max(schema.analyticsPageviews.timestamp),
      })
      .from(schema.analyticsPageviews)
      .where(gte(schema.analyticsPageviews.timestamp, since))
      .groupBy(schema.analyticsPageviews.path)
      .orderBy(desc(count()))
      .limit(limit);

    // Total stats
    const totals = await analyticsDb
      .select({
        totalViews: count(),
        uniquePaths: countDistinct(schema.analyticsPageviews.path),
        uniqueSessions: countDistinct(schema.analyticsPageviews.sessionId),
      })
      .from(schema.analyticsPageviews)
      .where(gte(schema.analyticsPageviews.timestamp, since));

    return NextResponse.json({
      generated: new Date().toISOString(),
      period: `Last ${days} days`,
      totals: totals[0],
      pages,
    });
  } catch (error) {
    console.error("[Analytics API] Pages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pages report" },
      { status: 500 }
    );
  }
}
