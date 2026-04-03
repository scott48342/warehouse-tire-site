/**
 * Resend Webhook Handler
 * 
 * POST /api/webhooks/resend
 * 
 * Handles email events from Resend:
 * - email.delivered
 * - email.opened
 * - email.clicked
 * - email.bounced
 * - email.complained
 * 
 * Updates campaign recipient status and logs events.
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import {
  emailCampaignRecipients,
  emailCampaignEvents,
  emailCampaigns,
  emailSubscribers,
} from "@/lib/fitment-db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Resend webhook event types
type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained";

interface ResendWebhookEvent {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    click?: { link: string };
    bounce?: { type: string; message: string };
  };
}

export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature if configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get("svix-signature");
      // TODO: Implement proper signature verification
      // For now, just check if header exists when secret is set
      if (!signature) {
        console.warn("[webhook/resend] Missing webhook signature");
        // Allow in development, reject in production
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

    const event: ResendWebhookEvent = await req.json();
    const { type, data } = event;

    console.log(`[webhook/resend] Received ${type} for ${data.to?.[0]}`);

    // Find the recipient by message_id
    const [recipient] = await db
      .select()
      .from(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.messageId, data.email_id))
      .limit(1);

    if (!recipient) {
      // This might be an abandoned cart email or other non-campaign email
      console.log(`[webhook/resend] No campaign recipient found for message ${data.email_id}`);
      return NextResponse.json({ status: "ok", note: "non_campaign_email" });
    }

    // Map event type to our status and event type
    let recipientStatus: string | undefined;
    let eventType: string;
    let timestampField: string | undefined;
    let campaignStatField: string | undefined;

    switch (type) {
      case "email.delivered":
        recipientStatus = "delivered";
        eventType = "delivered";
        timestampField = "deliveredAt";
        campaignStatField = "deliveredCount";
        break;
      case "email.opened":
        eventType = "opened";
        timestampField = "openedAt";
        campaignStatField = "openCount";
        break;
      case "email.clicked":
        eventType = "clicked";
        timestampField = "clickedAt";
        campaignStatField = "clickCount";
        break;
      case "email.bounced":
        recipientStatus = "bounced";
        eventType = "bounced";
        timestampField = "bouncedAt";
        campaignStatField = "bounceCount";
        break;
      case "email.complained":
        recipientStatus = "complained";
        eventType = "complained";
        timestampField = "complainedAt";
        campaignStatField = "complaintCount";
        break;
      default:
        console.log(`[webhook/resend] Ignoring event type: ${type}`);
        return NextResponse.json({ status: "ok", note: "ignored_event_type" });
    }

    // Update recipient record
    const updates: Record<string, any> = {};
    if (recipientStatus) updates.status = recipientStatus;
    if (timestampField) updates[timestampField] = new Date();

    if (Object.keys(updates).length > 0) {
      await db
        .update(emailCampaignRecipients)
        .set(updates)
        .where(eq(emailCampaignRecipients.id, recipient.id));
    }

    // Log event
    await db.insert(emailCampaignEvents).values({
      campaignId: recipient.campaignId,
      recipientId: recipient.id,
      eventType,
      email: recipient.email,
      linkUrl: data.click?.link,
      providerEventId: data.email_id,
      rawData: event,
    });

    // Update campaign stats (use raw SQL for atomic increment)
    if (campaignStatField) {
      await db.execute(
        sql`UPDATE email_campaigns SET ${sql.identifier(campaignStatField)} = ${sql.identifier(campaignStatField)} + 1, updated_at = NOW() WHERE id = ${recipient.campaignId}`
      );
    }

    // Handle bounces and complaints - suppress the subscriber
    if (type === "email.bounced" || type === "email.complained") {
      const suppressionReason = type === "email.bounced" ? "hard_bounce" : "complaint";
      
      await db
        .update(emailSubscribers)
        .set({
          suppressionReason,
          suppressedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(emailSubscribers.email, recipient.email));

      console.log(`[webhook/resend] Suppressed ${recipient.email}: ${suppressionReason}`);
    }

    return NextResponse.json({ status: "ok", processed: eventType });
  } catch (err: any) {
    console.error("[webhook/resend] error:", err);
    return NextResponse.json(
      { error: err.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
