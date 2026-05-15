/**
 * Jake Conversation API
 * 
 * Fetches full conversation history for a given session.
 * Used for conversation replay in admin dashboard.
 * 
 * @created 2026-05-15
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { eq, and, asc, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    // Fetch all messages for this session
    const messages = await analyticsDb
      .select({
        id: schema.jakeConversationMessages.id,
        role: schema.jakeConversationMessages.role,
        content: schema.jakeConversationMessages.content,
        createdAt: schema.jakeConversationMessages.createdAt,
      })
      .from(schema.jakeConversationMessages)
      .where(eq(schema.jakeConversationMessages.sessionId, sessionId))
      .orderBy(asc(schema.jakeConversationMessages.createdAt));

    // Also fetch session metadata from events
    const sessionEvents = await analyticsDb
      .select({
        eventName: schema.jakeAnalyticsEvents.eventName,
        vehicleYear: schema.jakeAnalyticsEvents.vehicleYear,
        vehicleMake: schema.jakeAnalyticsEvents.vehicleMake,
        vehicleModel: schema.jakeAnalyticsEvents.vehicleModel,
        vehicleTrim: schema.jakeAnalyticsEvents.vehicleTrim,
        source: schema.jakeAnalyticsEvents.source,
        cartUrl: schema.jakeAnalyticsEvents.cartUrl,
        cartValue: schema.jakeAnalyticsEvents.cartValue,
        createdAt: schema.jakeAnalyticsEvents.createdAt,
        hostname: schema.jakeAnalyticsEvents.hostname,
      })
      .from(schema.jakeAnalyticsEvents)
      .where(eq(schema.jakeAnalyticsEvents.sessionId, sessionId))
      .orderBy(asc(schema.jakeAnalyticsEvents.createdAt));

    // Extract session info
    const firstEvent = sessionEvents[0];
    const cartEvent = sessionEvents.find(e => e.eventName === "cart_created");
    const checkoutEvent = sessionEvents.find(e => e.eventName === "checkout_started");
    const vehicleEvent = sessionEvents.find(e => e.vehicleMake);

    const sessionInfo = {
      sessionId,
      source: firstEvent?.source || "unknown",
      hostname: firstEvent?.hostname || null,
      startedAt: firstEvent?.createdAt?.toISOString() || null,
      vehicle: vehicleEvent ? {
        year: vehicleEvent.vehicleYear,
        make: vehicleEvent.vehicleMake,
        model: vehicleEvent.vehicleModel,
        trim: vehicleEvent.vehicleTrim,
      } : null,
      outcome: checkoutEvent 
        ? "checkout_started" 
        : cartEvent 
          ? "cart_created" 
          : messages.length > 0 
            ? "conversation" 
            : "abandoned",
      cartUrl: cartEvent?.cartUrl || null,
      cartValue: cartEvent?.cartValue ? cartEvent.cartValue / 100 : null,
      events: sessionEvents.map(e => e.eventName),
    };

    return NextResponse.json({
      messages,
      session: sessionInfo,
      messageCount: messages.length,
    });
  } catch (error) {
    console.error("[Jake Conversation API] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
