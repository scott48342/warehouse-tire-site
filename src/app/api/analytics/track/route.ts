/**
 * Analytics Tracking API
 * 
 * POST /api/analytics/track
 * Captures client-side analytics events for server-side aggregation
 * 
 * Used by exit intent and other components for conversion tracking
 * 
 * @created 2026-04-23
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";

// In-memory buffer for recent events (for debugging)
// In production, you'd send these to a proper analytics service
const recentEvents: Array<{
  event: string;
  data: any;
  timestamp: number;
  ip: string;
}> = [];

const MAX_RECENT_EVENTS = 100;

/**
 * POST /api/analytics/track
 * 
 * Body:
 * - event: string (required)
 * - data: object (optional)
 * - timestamp: number (optional)
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    let parsed;
    
    try {
      parsed = JSON.parse(body);
    } catch {
      // Accept empty/malformed beacon requests gracefully
      return new Response(null, { status: 204 });
    }

    const { event, data = {}, timestamp = Date.now() } = parsed;

    if (!event) {
      return new Response(null, { status: 204 });
    }

    // Get IP for deduplication
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] || 
               headersList.get("x-real-ip") || 
               "unknown";

    // Store in memory buffer
    recentEvents.unshift({
      event,
      data,
      timestamp,
      ip,
    });

    // Trim buffer
    while (recentEvents.length > MAX_RECENT_EVENTS) {
      recentEvents.pop();
    }

    // Log exit intent events for visibility
    if (event.startsWith("exit_capture")) {
      console.log(`[Analytics] ${event}`, {
        ...data,
        timestamp: new Date(timestamp).toISOString(),
      });
    }

    // Return 204 No Content (standard for beacon)
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[analytics/track] Error:", err);
    return new Response(null, { status: 204 });
  }
}

/**
 * GET /api/analytics/track
 * Get recent events (for debugging/admin)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventFilter = url.searchParams.get("event");
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  let events = recentEvents;
  
  if (eventFilter) {
    events = events.filter(e => e.event.includes(eventFilter));
  }

  return NextResponse.json({
    events: events.slice(0, limit),
    total: events.length,
  });
}
