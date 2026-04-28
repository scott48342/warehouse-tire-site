/**
 * Live Visitor Session Detail API
 * 
 * GET /api/admin/live-visitors/[sessionId]
 * Returns page history for a specific session
 * 
 * DELETE /api/admin/live-visitors/[sessionId]
 * Marks session as test (removes from active visitors)
 * 
 * @updated 2026-04-27 - Added funnel_events fallback for timeline
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { eq, desc } from "drizzle-orm";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Try analytics_sessions first
    let session: any = null;
    let timeline: any[] = [];
    let source = "analytics";

    const [analyticsSession] = await analyticsDb
      .select()
      .from(schema.analyticsSessions)
      .where(eq(schema.analyticsSessions.sessionId, sessionId))
      .limit(1);

    if (analyticsSession) {
      session = analyticsSession;
      
      // Get page history from analytics_pageviews
      const pageviews = await analyticsDb
        .select({
          path: schema.analyticsPageviews.path,
          timestamp: schema.analyticsPageviews.timestamp,
        })
        .from(schema.analyticsPageviews)
        .where(eq(schema.analyticsPageviews.sessionId, sessionId))
        .orderBy(desc(schema.analyticsPageviews.timestamp))
        .limit(50);

      // Format timeline - send ISO timestamp, client will format in local timezone
      timeline = pageviews.reverse().map((pv, idx) => {
        const time = new Date(pv.timestamp);
        const prevTime = idx > 0 ? new Date(pageviews[pageviews.length - idx].timestamp) : null;
        const duration = prevTime 
          ? Math.floor((time.getTime() - prevTime.getTime()) / 1000)
          : null;

        return {
          path: pv.path,
          time: time.toISOString(),
          timestamp: time.getTime(), // Send raw timestamp for client-side formatting
          durationOnPage: duration,
        };
      });
    }

    // If no analytics data or empty timeline, try funnel_events
    if (!session || timeline.length === 0) {
      const funnelResult = await pool.query(`
        SELECT 
          event_name,
          page_url,
          created_at,
          device_type,
          referrer,
          utm_source,
          utm_campaign,
          store_mode
        FROM funnel_events 
        WHERE session_id = $1
        ORDER BY created_at ASC
        LIMIT 50
      `, [sessionId]);

      if (funnelResult.rows.length > 0) {
        source = "funnel_events";
        const events = funnelResult.rows;
        
        // Build session info from first event
        const firstEvent = events[0];
        const lastEvent = events[events.length - 1];
        
        let landingPage = "/";
        let currentPage = "/";
        let hostname = "shop.warehousetiredirect.com";
        
        try {
          if (firstEvent.page_url) {
            const url = new URL(firstEvent.page_url);
            landingPage = url.pathname + url.search;
            hostname = url.hostname;
          }
          if (lastEvent.page_url) {
            const url = new URL(lastEvent.page_url);
            currentPage = url.pathname + url.search;
          }
        } catch {}

        session = {
          landingPage,
          currentPage,
          firstSeenAt: firstEvent.created_at,
          lastSeenAt: lastEvent.created_at,
          pageViewCount: events.length,
          deviceType: firstEvent.device_type,
          country: null,
          city: null,
          region: null,
          referrer: firstEvent.referrer,
          utmSource: firstEvent.utm_source,
          utmCampaign: firstEvent.utm_campaign,
          hostname,
        };

        // Build timeline from funnel events - send timestamp for client-side formatting
        timeline = events.map((evt: any) => {
          let path = "/";
          try {
            if (evt.page_url) {
              const url = new URL(evt.page_url);
              path = url.pathname + url.search;
            }
          } catch {
            path = evt.page_url || "/";
          }

          const time = new Date(evt.created_at);
          return {
            path,
            event: evt.event_name,
            time: time.toISOString(),
            timestamp: time.getTime(), // Send raw timestamp for client-side formatting
          };
        });
      }
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      sessionId,
      source,
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
      pageCount: timeline.length,
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
