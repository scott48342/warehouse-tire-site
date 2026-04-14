import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Analytics Event Endpoint
 * 
 * Receives client-side events and logs them for analysis.
 * Currently logs to console in development, can be extended to:
 * - Write to database
 * - Send to analytics service (Amplitude, Mixpanel, etc.)
 * - Store in data warehouse
 */

interface AnalyticsEventPayload {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
  sessionId?: string;
  cartId?: string;
  url?: string;
  referrer?: string;
}

// Important events to log more verbosely
const IMPORTANT_EVENTS = [
  "smart_tire_upsell_shown",
  "smart_tire_upsell_accepted",
  "smart_tire_upsell_skipped",
  "checkout_started",
  "checkout_completed",
  "package_completed",
];

export async function POST(req: NextRequest) {
  try {
    const body: AnalyticsEventPayload = await req.json();
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
    }

    // Log event (extend this to write to DB, send to analytics service, etc.)
    const isImportant = IMPORTANT_EVENTS.includes(body.name);
    
    if (isImportant || process.env.NODE_ENV === "development") {
      console.log(`[Analytics] ${body.name}`, {
        properties: body.properties,
        sessionId: body.sessionId,
        cartId: body.cartId,
        timestamp: body.timestamp,
      });
    }

    // TODO: Write to analytics database
    // await writeToAnalyticsDB(body);

    // TODO: Send to external analytics service
    // await sendToAmplitude(body);

    return NextResponse.json({ ok: true });
    
  } catch (e: any) {
    console.error("[Analytics] Event processing error:", e);
    // Always return 200 for analytics - don't break client
    return NextResponse.json({ ok: true });
  }
}
