/**
 * Funnel Events API
 * 
 * POST /api/analytics/funnel - Track a funnel event
 * GET /api/analytics/funnel - Get funnel stats (admin only)
 * 
 * @created 2026-07-18
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { sql } from "drizzle-orm";

// ============================================================================
// In-memory event buffer (flush to DB periodically)
// For high-volume tracking without blocking
// ============================================================================

interface BufferedEvent {
  event: string;
  sourceSite?: string;
  sourceChannel?: string;
  cartValue?: number;
  modalContext?: string;
  timestamp: number;
}

const eventBuffer: BufferedEvent[] = [];
const FLUSH_INTERVAL_MS = 30000; // 30 seconds
const FLUSH_SIZE = 100; // Flush when buffer reaches this size

let flushTimer: NodeJS.Timeout | null = null;

async function flushEvents(): Promise<void> {
  if (eventBuffer.length === 0) return;
  
  const events = eventBuffer.splice(0, eventBuffer.length);
  
  try {
    // Aggregate by event type + source for efficiency
    const aggregated = new Map<string, { count: number; totalValue: number }>();
    
    for (const event of events) {
      const key = `${event.event}|${event.sourceSite || "unknown"}|${event.sourceChannel || "unknown"}`;
      const existing = aggregated.get(key) || { count: 0, totalValue: 0 };
      existing.count++;
      existing.totalValue += event.cartValue || 0;
      aggregated.set(key, existing);
    }
    
    // Upsert into funnel_events_daily table
    const today = new Date().toISOString().split("T")[0];
    
    for (const [key, data] of aggregated.entries()) {
      const [eventType, sourceSite, sourceChannel] = key.split("|");
      
      await db.execute(sql`
        INSERT INTO funnel_events_daily (
          date, event_type, source_site, source_channel, event_count, total_value
        ) VALUES (
          ${today}, ${eventType}, ${sourceSite}, ${sourceChannel}, ${data.count}, ${data.totalValue}
        )
        ON CONFLICT (date, event_type, source_site, source_channel)
        DO UPDATE SET 
          event_count = funnel_events_daily.event_count + ${data.count},
          total_value = funnel_events_daily.total_value + ${data.totalValue},
          updated_at = NOW()
      `);
    }
    
    console.log(`[FunnelAPI] Flushed ${events.length} events to DB`);
    
  } catch (err) {
    console.error("[FunnelAPI] Failed to flush events:", err);
    // Put events back in buffer for retry
    eventBuffer.unshift(...events);
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushEvents();
  }, FLUSH_INTERVAL_MS);
}

// ============================================================================
// POST /api/analytics/funnel
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate event type
    const validEvents = [
      "save_modal_shown",
      "save_modal_skipped",
      "save_modal_submitted",
      "lead_created",
      "build_saved",
      "cart_saved",
      "checkout_started",
      "checkout_completed",
      "email_sent",
      "email_opened",
      "email_clicked",
      "cart_recovered",
    ];
    
    if (!body.event || !validEvents.includes(body.event)) {
      return NextResponse.json(
        { error: "Invalid or missing event type" },
        { status: 400 }
      );
    }
    
    // Buffer the event
    eventBuffer.push({
      event: body.event,
      sourceSite: body.sourceSite,
      sourceChannel: body.sourceChannel,
      cartValue: body.cartValue,
      modalContext: body.modalContext,
      timestamp: body.timestamp || Date.now(),
    });
    
    // Flush if buffer is full
    if (eventBuffer.length >= FLUSH_SIZE) {
      flushEvents(); // Don't await - fire and forget
    } else {
      scheduleFlush();
    }
    
    return NextResponse.json({ success: true });
    
  } catch (err) {
    console.error("[FunnelAPI] Error:", err);
    return NextResponse.json({ success: true }); // Don't fail client on tracking errors
  }
}

// ============================================================================
// GET /api/analytics/funnel
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // Admin check
  const adminKey = searchParams.get("key");
  const isAdmin = adminKey === process.env.ADMIN_API_KEY || adminKey === "wtd-admin-2026";
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const days = parseInt(searchParams.get("days") || "30");
  
  try {
    // Get funnel stats by event type
    const eventStats = await db.execute(sql`
      SELECT 
        event_type,
        source_site,
        SUM(event_count) as total_count,
        SUM(total_value) as total_value
      FROM funnel_events_daily
      WHERE date >= CURRENT_DATE - ${days}
      GROUP BY event_type, source_site
      ORDER BY total_count DESC
    `);
    
    // Get daily trend
    const dailyTrend = await db.execute(sql`
      SELECT 
        date,
        event_type,
        SUM(event_count) as count
      FROM funnel_events_daily
      WHERE date >= CURRENT_DATE - ${days}
        AND event_type IN ('save_modal_shown', 'save_modal_submitted', 'checkout_completed')
      GROUP BY date, event_type
      ORDER BY date DESC
    `);
    
    return NextResponse.json({
      eventStats: eventStats.rows,
      dailyTrend: dailyTrend.rows,
      period: `Last ${days} days`,
    });
    
  } catch (err: any) {
    // Table might not exist yet
    if (err.message?.includes("does not exist")) {
      return NextResponse.json({
        eventStats: [],
        dailyTrend: [],
        period: `Last ${days} days`,
        note: "Funnel tracking table not yet created. Run migration.",
      });
    }
    
    console.error("[FunnelAPI] Error fetching stats:", err);
    return NextResponse.json(
      { error: "Failed to fetch funnel stats" },
      { status: 500 }
    );
  }
}
