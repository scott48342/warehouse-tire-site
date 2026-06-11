import { NextRequest, NextResponse } from "next/server";

/**
 * Quick View Analytics Endpoint
 * 
 * Collects quick view interaction data for conversion analysis.
 * Events are logged and can be queried for funnel analysis.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      event,
      product_sku,
      product_type,
      has_active_vehicle,
      timestamp,
      url,
      referrer,
      time_open_ms,
    } = body;

    // Validate required fields
    if (!event || !product_sku || !product_type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Log the event (in production, this would go to a proper analytics store)
    console.log(`[QuickView Event] ${event}`, {
      product_sku,
      product_type,
      has_active_vehicle,
      timestamp,
      url,
      referrer,
      time_open_ms,
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent"),
    });

    // In a real implementation, you'd:
    // 1. Store to a database table (quick_view_events)
    // 2. Or send to an analytics service (Mixpanel, Amplitude, etc.)
    // 3. Or push to a data warehouse (BigQuery, Snowflake, etc.)
    
    // For MVP, we just acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[QuickView Analytics] Error processing event:", error);
    return NextResponse.json(
      { error: "Failed to process event" },
      { status: 500 }
    );
  }
}

// Don't cache analytics requests
export const dynamic = "force-dynamic";
