import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { desc, gte, eq, and, count, sql } from "drizzle-orm";

/**
 * Jake Analytics Endpoint
 * 
 * Receives analytics events from the Jake chat component.
 * Persists to database for dashboard reporting.
 * 
 * @updated 2026-05-14 - Added persistent DB storage
 */

interface JakeAnalyticsEvent {
  event: string;
  data?: {
    source?: string;
    sessionId?: string;
    requestId?: string;
    prompt?: string;
    intent?: string;
    vehicle?: {
      year?: string;
      make?: string;
      model?: string;
      trim?: string;
    };
    product?: {
      sku?: string;
      type?: string;
      brand?: string;
      model?: string;
      price?: number;
    };
    products?: Array<{
      sku?: string;
      type?: string;
      brand?: string;
      model?: string;
    }>;
    cartId?: string;
    cartUrl?: string;
    cartValue?: number;
    orderId?: string;
    orderValue?: number;
    error?: {
      type?: string;
      message?: string;
    };
    [key: string]: unknown;
  };
  timestamp: string;
  url: string;
  userAgent: string;
}

// Test detection patterns
const TEST_PATTERNS = {
  userAgents: [/HeadlessChrome/i, /Playwright/i, /Puppeteer/i, /bot/i, /crawler/i],
  hostnames: ["localhost", "127.0.0.1", "preview.vercel.app"],
  emails: [/@test\./, /@example\./, /test@/i],
};

function isTestTraffic(event: JakeAnalyticsEvent): { isTest: boolean; reason?: string } {
  // Check user agent
  for (const pattern of TEST_PATTERNS.userAgents) {
    if (pattern.test(event.userAgent || "")) {
      return { isTest: true, reason: "bot_user_agent" };
    }
  }
  
  // Check hostname
  try {
    const url = new URL(event.url);
    for (const testHost of TEST_PATTERNS.hostnames) {
      if (url.hostname.includes(testHost)) {
        return { isTest: true, reason: "test_hostname" };
      }
    }
    // Preview deployments
    if (url.hostname.includes("-git-") || url.hostname.endsWith(".vercel.app")) {
      return { isTest: true, reason: "preview_deployment" };
    }
  } catch {
    // Invalid URL
  }
  
  return { isTest: false };
}

function extractIntent(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase();
  
  // Common intents
  if (lowerPrompt.includes("cheap") || lowerPrompt.includes("budget") || lowerPrompt.includes("affordable")) {
    return "budget";
  }
  if (lowerPrompt.includes("all-terrain") || lowerPrompt.includes("all terrain") || lowerPrompt.includes("a/t")) {
    return "all_terrain";
  }
  if (lowerPrompt.includes("mud") || lowerPrompt.includes("m/t")) {
    return "mud_terrain";
  }
  if (lowerPrompt.includes("quiet") || lowerPrompt.includes("highway") || lowerPrompt.includes("touring")) {
    return "highway";
  }
  if (lowerPrompt.includes("tow") || lowerPrompt.includes("haul")) {
    return "towing";
  }
  if (lowerPrompt.includes("35") || lowerPrompt.includes("33") || lowerPrompt.includes("lift")) {
    return "lifted_truck";
  }
  if (lowerPrompt.includes("wheel") && lowerPrompt.includes("tire")) {
    return "package";
  }
  if (lowerPrompt.includes("wheel") || lowerPrompt.includes("rim")) {
    return "wheels";
  }
  if (lowerPrompt.includes("black")) {
    return "black_wheels";
  }
  if (lowerPrompt.includes("fit")) {
    return "fitment_question";
  }
  
  return null;
}

// Ensure table exists
async function ensureJakeTable() {
  try {
    await analyticsDb.execute(sql`
      CREATE TABLE IF NOT EXISTS jake_analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_name VARCHAR(50) NOT NULL,
        session_id VARCHAR(64),
        request_id VARCHAR(64),
        source VARCHAR(50),
        vehicle_year VARCHAR(10),
        vehicle_make VARCHAR(50),
        vehicle_model VARCHAR(50),
        vehicle_trim VARCHAR(100),
        prompt TEXT,
        intent VARCHAR(100),
        product_sku VARCHAR(50),
        product_type VARCHAR(20),
        product_brand VARCHAR(50),
        product_model VARCHAR(100),
        cart_id VARCHAR(64),
        cart_url TEXT,
        cart_value INTEGER,
        order_id VARCHAR(50),
        order_value INTEGER,
        error_type VARCHAR(50),
        error_message TEXT,
        metadata TEXT,
        user_agent TEXT,
        hostname VARCHAR(100),
        url VARCHAR(500),
        is_test BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS jake_events_event_name_idx ON jake_analytics_events(event_name);
      CREATE INDEX IF NOT EXISTS jake_events_session_idx ON jake_analytics_events(session_id);
      CREATE INDEX IF NOT EXISTS jake_events_created_at_idx ON jake_analytics_events(created_at);
      CREATE INDEX IF NOT EXISTS jake_events_product_sku_idx ON jake_analytics_events(product_sku);
      CREATE INDEX IF NOT EXISTS jake_events_is_test_idx ON jake_analytics_events(is_test);
      CREATE INDEX IF NOT EXISTS jake_events_hostname_idx ON jake_analytics_events(hostname);
    `);
  } catch (err) {
    console.error("[Jake Analytics] Failed to ensure table:", err);
  }
}

let tableEnsured = false;

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
    });

    // Ensure table exists
    if (!tableEnsured) {
      await ensureJakeTable();
      tableEnsured = true;
    }

    // Detect test traffic
    const { isTest } = isTestTraffic(event);
    
    // Extract hostname
    let hostname: string | null = null;
    try {
      hostname = new URL(event.url).hostname;
    } catch {}
    
    // Extract intent from prompt
    const intent = event.data?.prompt ? extractIntent(event.data.prompt) : null;
    
    // Build metadata (extra fields not in columns)
    const metadata: Record<string, unknown> = {};
    if (event.data?.products) metadata.products = event.data.products;
    if (event.data && Object.keys(event.data).length > 0) {
      // Copy any extra fields
      const knownFields = ["source", "sessionId", "requestId", "prompt", "vehicle", "product", "cartId", "cartUrl", "cartValue", "orderId", "orderValue", "error", "products"];
      for (const [key, value] of Object.entries(event.data)) {
        if (!knownFields.includes(key)) {
          metadata[key] = value;
        }
      }
    }
    
    // Insert into database
    await analyticsDb.insert(schema.jakeAnalyticsEvents).values({
      eventName: event.event,
      sessionId: event.data?.sessionId || null,
      requestId: event.data?.requestId || null,
      source: event.data?.source || null,
      vehicleYear: event.data?.vehicle?.year || null,
      vehicleMake: event.data?.vehicle?.make || null,
      vehicleModel: event.data?.vehicle?.model || null,
      vehicleTrim: event.data?.vehicle?.trim || null,
      prompt: event.data?.prompt || null,
      intent,
      productSku: event.data?.product?.sku || null,
      productType: event.data?.product?.type || null,
      productBrand: event.data?.product?.brand || null,
      productModel: event.data?.product?.model || null,
      cartId: event.data?.cartId || null,
      cartUrl: event.data?.cartUrl || null,
      cartValue: event.data?.cartValue ? Math.round(event.data.cartValue * 100) : null,
      orderId: event.data?.orderId || null,
      orderValue: event.data?.orderValue ? Math.round(event.data.orderValue * 100) : null,
      errorType: event.data?.error?.type || null,
      errorMessage: event.data?.error?.message || null,
      metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      userAgent: event.userAgent || null,
      hostname,
      url: event.url || null,
      isTest,
    });

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

// GET endpoint to view recent analytics (legacy, for backward compat)
export async function GET(request: NextRequest) {
  try {
    const includeTest = request.nextUrl.searchParams.get("includeTest") === "1";
    
    // Build filter
    const filter = includeTest ? undefined : eq(schema.jakeAnalyticsEvents.isTest, false);
    
    // Get recent events
    const recentEvents = await analyticsDb
      .select()
      .from(schema.jakeAnalyticsEvents)
      .where(filter)
      .orderBy(desc(schema.jakeAnalyticsEvents.createdAt))
      .limit(50);
    
    // Get event counts
    const eventCounts = await analyticsDb
      .select({
        eventName: schema.jakeAnalyticsEvents.eventName,
        count: count(),
      })
      .from(schema.jakeAnalyticsEvents)
      .where(filter)
      .groupBy(schema.jakeAnalyticsEvents.eventName);
    
    const stats = {
      totalEvents: eventCounts.reduce((sum, e) => sum + e.count, 0),
      recentEvents,
      eventCounts: Object.fromEntries(eventCounts.map(e => [e.eventName, e.count])),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Jake Analytics] Error fetching stats:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
