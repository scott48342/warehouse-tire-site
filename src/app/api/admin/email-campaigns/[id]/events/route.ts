/**
 * GET /api/admin/email-campaigns/[id]/events
 * Get campaign events (opens, clicks, bounces, etc.)
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db";
import { emailCampaignEvents, emailCampaignRecipients } from "@/lib/fitment-db/schema";
import { eq, and, desc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    
    const eventType = searchParams.get("eventType") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get events with recipient email
    const conditions = [eq(emailCampaignEvents.campaignId, id)];
    if (eventType) {
      conditions.push(eq(emailCampaignEvents.eventType, eventType as any));
    }

    const events = await db
      .select({
        id: emailCampaignEvents.id,
        recipientId: emailCampaignEvents.recipientId,
        email: emailCampaignRecipients.email,
        eventType: emailCampaignEvents.eventType,
        metadata: emailCampaignEvents.metadata,
        occurredAt: emailCampaignEvents.occurredAt,
      })
      .from(emailCampaignEvents)
      .leftJoin(
        emailCampaignRecipients,
        eq(emailCampaignEvents.recipientId, emailCampaignRecipients.id)
      )
      .where(and(...conditions))
      .orderBy(desc(emailCampaignEvents.occurredAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      events: events.map((e) => ({
        ...e,
        id: e.id.toString(),
        recipientId: e.recipientId.toString(),
      })),
    });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/events] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to get events" },
      { status: 500 }
    );
  }
}
