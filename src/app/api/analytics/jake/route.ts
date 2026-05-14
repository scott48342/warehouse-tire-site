import { NextRequest, NextResponse } from "next/server";

/**
 * Jake Analytics Endpoint
 * 
 * Receives analytics events from the Jake chat component.
 * Currently logs to console; can be extended to forward to:
 * - Google Analytics
 * - Mixpanel
 * - Custom analytics database
 * - Slack notifications for key events
 */

interface JakeAnalyticsEvent {
  event: string;
  data?: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
}

// In-memory analytics buffer (for development/demo)
// In production, replace with Redis or database
const analyticsBuffer: JakeAnalyticsEvent[] = [];
const MAX_BUFFER_SIZE = 1000;

export async function POST(request: NextRequest) {
  try {
    const event: JakeAnalyticsEvent = await request.json();

    // Validate event
    if (!event.event || typeof event.event !== "string") {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    // Log the event
    console.log(`[Jake Analytics] ${event.event}`, {
      data: event.data,
      timestamp: event.timestamp,
      url: event.url,
    });

    // Store in buffer
    analyticsBuffer.push(event);
    if (analyticsBuffer.length > MAX_BUFFER_SIZE) {
      analyticsBuffer.shift(); // Remove oldest
    }

    // Track key conversion events specially
    if (event.event === "checkout_started") {
      console.log("[Jake Analytics] 🎉 CONVERSION: User started checkout from Jake!");
    }

    if (event.event === "cart_created") {
      console.log("[Jake Analytics] 🛒 Cart created via Jake assistant");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Jake Analytics] Error processing event:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET endpoint to view recent analytics (admin only in production)
export async function GET(request: NextRequest) {
  // In production, add auth check here
  const stats = {
    totalEvents: analyticsBuffer.length,
    recentEvents: analyticsBuffer.slice(-50),
    eventCounts: analyticsBuffer.reduce((acc, e) => {
      acc[e.event] = (acc[e.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return NextResponse.json(stats);
}
