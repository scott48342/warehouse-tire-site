/**
 * Live Visitor Session Detail API
 * 
 * GET /api/admin/live-visitors/[sessionId]
 * Returns page history for a specific session
 * 
 * DELETE /api/admin/live-visitors/[sessionId]
 * Marks session as test (removes from active visitors)
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Get session info
    const [session] = await analyticsDb
      .select()
      .from(schema.analyticsSessions)
      .where(eq(schema.analyticsSessions.sessionId, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get page history
    const pageviews = await analyticsDb
      .select({
        path: schema.analyticsPageviews.path,
        timestamp: schema.analyticsPageviews.timestamp,
      })
      .from(schema.analyticsPageviews)
      .where(eq(schema.analyticsPageviews.sessionId, sessionId))
      .orderBy(desc(schema.analyticsPageviews.timestamp))
      .limit(50);

    // Format timeline
    const timeline = pageviews.reverse().map((pv, idx) => {
      const time = new Date(pv.timestamp);
      const prevTime = idx > 0 ? new Date(pageviews[pageviews.length - idx].timestamp) : null;
      const duration = prevTime 
        ? Math.floor((time.getTime() - prevTime.getTime()) / 1000)
        : null;

      return {
        path: pv.path,
        time: time.toISOString(),
        timeDisplay: time.toLocaleTimeString(),
        durationOnPage: duration,
      };
    });

    return NextResponse.json({
      sessionId,
      session: {
        landingPage: session.landingPage,
        currentPage: session.currentPage,
        firstSeenAt: session.firstSeenAt,
        lastSeenAt: session.lastSeenAt,
        pageViewCount: session.pageViewCount,
        deviceType: session.deviceType,
        country: session.country,
        city: session.city,
        region: session.region,
        referrer: session.referrer,
        utmSource: session.utmSource,
        utmCampaign: session.utmCampaign,
        hostname: session.hostname,
      },
      timeline,
      pageCount: pageviews.length,
    });
  } catch (error) {
    console.error("[Live Visitor Detail] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Mark session as test (removes from active visitors)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Mark as test instead of deleting (preserves analytics data)
    const result = await analyticsDb
      .update(schema.analyticsSessions)
      .set({ 
        isTest: true, 
        testReason: "admin_excluded" 
      })
      .where(eq(schema.analyticsSessions.sessionId, sessionId));

    return NextResponse.json({ 
      success: true, 
      message: "Session marked as test",
      sessionId 
    });
  } catch (error) {
    console.error("[Live Visitor Delete] Error:", error);
    return NextResponse.json(
      { error: "Failed to remove session" },
      { status: 500 }
    );
  }
}
