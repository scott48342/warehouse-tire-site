/**
 * Campaign Service
 * 
 * Core service for managing email campaigns:
 * - CRUD operations
 * - Scheduling
 * - Send orchestration
 * - Stats tracking
 * 
 * @created 2026-04-03
 */

import { Resend } from "resend";
import { db } from "@/lib/fitment-db/db";
import {
  emailCampaigns,
  emailCampaignRecipients,
  emailCampaignEvents,
  emailSubscribers,
  type EmailCampaign,
  type NewEmailCampaign,
  type EmailCampaignRecipient,
} from "@/lib/fitment-db/schema";
import { eq, and, inArray, sql, desc, count, lt, isNull } from "drizzle-orm";
import { BRAND } from "@/lib/brand";
import { audienceResolver } from "./audienceResolver";
import { campaignRenderer, generateUnsubscribeUrl } from "./campaignRenderer";
import type { AudienceRules, CampaignContent, CampaignStats, CampaignStatus } from "./types";

// ============================================================================
// Configuration
// ============================================================================

/** Safe mode: log instead of send */
export const CAMPAIGN_SAFE_MODE = process.env.EMAIL_SAFE_MODE === "true";

/** Batch size for sending */
const SEND_BATCH_SIZE = 50;

/** Delay between batches (ms) */
const SEND_BATCH_DELAY_MS = 2000;

/** From email address */
const FROM_EMAIL = process.env.EMAIL_FROM || "marketing@warehousetiredirect.com";

// ============================================================================
// Resend Client
// ============================================================================

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[campaignService] RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(apiKey);
}

// ============================================================================
// Campaign CRUD
// ============================================================================

/**
 * Create a new campaign
 */
export async function createCampaign(data: {
  name: string;
  campaignType: string;
  subject: string;
  previewText?: string;
  fromName?: string;
  replyTo?: string;
  contentJson?: CampaignContent;
  audienceRulesJson?: AudienceRules;
  includeFreeShippingBanner?: boolean;
  includePriceMatch?: boolean;
  utmCampaign?: string;
  isTest?: boolean;
  createdBy?: string;
  notes?: string;
}): Promise<EmailCampaign> {
  const [campaign] = await db
    .insert(emailCampaigns)
    .values({
      name: data.name,
      campaignType: data.campaignType,
      status: "draft",
      subject: data.subject,
      previewText: data.previewText,
      fromName: data.fromName || BRAND.name,
      replyTo: data.replyTo || BRAND.email,
      contentJson: data.contentJson || { blocks: [] },
      audienceRulesJson: data.audienceRulesJson || {},
      includeFreeShippingBanner: data.includeFreeShippingBanner ?? true,
      includePriceMatch: data.includePriceMatch ?? true,
      utmCampaign: data.utmCampaign,
      isTest: data.isTest ?? false,
      createdBy: data.createdBy,
      notes: data.notes,
    })
    .returning();

  console.log(`[campaignService] Created campaign ${campaign.id}: ${campaign.name}`);
  return campaign;
}

/**
 * Get campaign by ID
 */
export async function getCampaign(id: string): Promise<EmailCampaign | null> {
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, id))
    .limit(1);

  return campaign || null;
}

/**
 * List campaigns with optional filters
 */
export async function listCampaigns(options?: {
  status?: CampaignStatus;
  campaignType?: string;
  includeTest?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ campaigns: EmailCampaign[]; total: number }> {
  const { status, campaignType, includeTest = false, limit = 50, offset = 0 } = options || {};

  const conditions: any[] = [];

  if (!includeTest) {
    conditions.push(eq(emailCampaigns.isTest, false));
  }

  if (status) {
    conditions.push(eq(emailCampaigns.status, status));
  }

  if (campaignType) {
    conditions.push(eq(emailCampaigns.campaignType, campaignType));
  }

  const campaigns = await db
    .select()
    .from(emailCampaigns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(emailCampaigns.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: count() })
    .from(emailCampaigns)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    campaigns,
    total: Number(countResult?.count || 0),
  };
}

/**
 * Update campaign
 */
export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string;
    campaignType: string;
    subject: string;
    previewText: string;
    fromName: string;
    replyTo: string;
    contentJson: CampaignContent;
    audienceRulesJson: AudienceRules;
    includeFreeShippingBanner: boolean;
    includePriceMatch: boolean;
    utmCampaign: string;
    notes: string;
  }>
): Promise<EmailCampaign | null> {
  // Only allow updates on draft campaigns
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  if (campaign.status !== "draft") {
    throw new Error(`Cannot update campaign in ${campaign.status} status`);
  }

  const [updated] = await db
    .update(emailCampaigns)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, id))
    .returning();

  return updated;
}

/**
 * Duplicate a campaign
 */
export async function duplicateCampaign(id: string): Promise<EmailCampaign | null> {
  const original = await getCampaign(id);
  if (!original) return null;

  return createCampaign({
    name: `${original.name} (Copy)`,
    campaignType: original.campaignType,
    subject: original.subject,
    previewText: original.previewText || undefined,
    fromName: original.fromName || undefined,
    replyTo: original.replyTo || undefined,
    contentJson: original.contentJson as CampaignContent,
    audienceRulesJson: original.audienceRulesJson as AudienceRules,
    includeFreeShippingBanner: original.includeFreeShippingBanner,
    includePriceMatch: original.includePriceMatch,
    utmCampaign: original.utmCampaign || undefined,
    isTest: original.isTest,
    notes: original.notes || undefined,
  });
}

/**
 * Delete campaign (only draft campaigns)
 */
export async function deleteCampaign(id: string): Promise<boolean> {
  const campaign = await getCampaign(id);
  if (!campaign) return false;

  if (campaign.status !== "draft" && campaign.status !== "cancelled") {
    throw new Error(`Cannot delete campaign in ${campaign.status} status`);
  }

  await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
  return true;
}

// ============================================================================
// Scheduling
// ============================================================================

/**
 * Schedule a campaign for future send
 */
export async function scheduleCampaign(
  id: string,
  scheduledFor: Date
): Promise<EmailCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  if (campaign.status !== "draft") {
    throw new Error(`Cannot schedule campaign in ${campaign.status} status`);
  }

  if (scheduledFor <= new Date()) {
    throw new Error("Scheduled time must be in the future");
  }

  // Build audience snapshot
  const { count: recipientCount, errors } = await audienceResolver.buildRecipientSnapshot(
    id,
    campaign.audienceRulesJson as AudienceRules
  );

  if (errors.length > 0) {
    console.warn(`[campaignService] Audience build warnings:`, errors);
  }

  if (recipientCount === 0) {
    throw new Error("No eligible recipients found for this campaign");
  }

  const [updated] = await db
    .update(emailCampaigns)
    .set({
      status: "scheduled",
      scheduledFor,
      totalRecipients: recipientCount,
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, id))
    .returning();

  console.log(`[campaignService] Scheduled campaign ${id} for ${scheduledFor.toISOString()} with ${recipientCount} recipients`);
  return updated;
}

/**
 * Start a campaign immediately
 */
export async function startCampaignNow(id: string): Promise<EmailCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    throw new Error(`Cannot start campaign in ${campaign.status} status`);
  }

  // Build audience snapshot if not already built
  let recipientCount = campaign.totalRecipients;

  if (recipientCount === 0) {
    const result = await audienceResolver.buildRecipientSnapshot(
      id,
      campaign.audienceRulesJson as AudienceRules
    );
    recipientCount = result.count;

    if (recipientCount === 0) {
      throw new Error("No eligible recipients found for this campaign");
    }
  }

  const [updated] = await db
    .update(emailCampaigns)
    .set({
      status: "sending",
      startedAt: new Date(),
      totalRecipients: recipientCount,
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, id))
    .returning();

  console.log(`[campaignService] Started campaign ${id} with ${recipientCount} recipients`);
  return updated;
}

/**
 * Pause a sending campaign
 */
export async function pauseCampaign(id: string): Promise<EmailCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign || campaign.status !== "sending") return null;

  const [updated] = await db
    .update(emailCampaigns)
    .set({
      status: "paused",
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, id))
    .returning();

  return updated;
}

/**
 * Resume a paused campaign
 */
export async function resumeCampaign(id: string): Promise<EmailCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign || campaign.status !== "paused") return null;

  const [updated] = await db
    .update(emailCampaigns)
    .set({
      status: "sending",
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, id))
    .returning();

  return updated;
}

/**
 * Cancel a campaign
 */
export async function cancelCampaign(id: string): Promise<EmailCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
    throw new Error(`Cannot cancel campaign in ${campaign.status} status`);
  }

  const [updated] = await db
    .update(emailCampaigns)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, id))
    .returning();

  return updated;
}

// ============================================================================
// Test Sending
// ============================================================================

/**
 * Send a test email for a campaign
 */
export async function sendTestEmail(
  id: string,
  testEmail: string
): Promise<{ success: boolean; error?: string }> {
  const campaign = await getCampaign(id);
  if (!campaign) {
    return { success: false, error: "Campaign not found" };
  }

  const content = campaign.contentJson as CampaignContent;
  const unsubscribeUrl = generateUnsubscribeUrl(testEmail);

  const html = campaignRenderer.renderCampaignEmail({
    subject: `[TEST] ${campaign.subject}`,
    previewText: campaign.previewText || undefined,
    content,
    includeFreeShippingBanner: campaign.includeFreeShippingBanner,
    includePriceMatch: campaign.includePriceMatch,
    utmCampaign: campaign.utmCampaign || undefined,
    unsubscribeUrl,
    recipientEmail: testEmail,
  });

  if (CAMPAIGN_SAFE_MODE) {
    console.log(`[campaignService] SAFE_MODE - Would send test email to ${testEmail}`);
    console.log(`  Subject: [TEST] ${campaign.subject}`);
    return { success: true };
  }

  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: "Email provider not configured" };
  }

  try {
    const fromAddress = campaign.fromName
      ? `${campaign.fromName} <${FROM_EMAIL}>`
      : FROM_EMAIL;

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: testEmail,
      subject: `[TEST] ${campaign.subject}`,
      html,
      replyTo: campaign.replyTo || BRAND.email,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    console.log(`[campaignService] Sent test email for campaign ${id} to ${testEmail}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// Batch Sending (called by cron)
// ============================================================================

/**
 * Process a batch of pending recipients for a campaign
 */
export async function processSendBatch(
  campaignId: string,
  batchSize: number = SEND_BATCH_SIZE
): Promise<{ sent: number; failed: number; remaining: number }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.status !== "sending") {
    return { sent: 0, failed: 0, remaining: 0 };
  }

  // Get pending recipients
  const pendingRecipients = await db
    .select()
    .from(emailCampaignRecipients)
    .where(
      and(
        eq(emailCampaignRecipients.campaignId, campaignId),
        eq(emailCampaignRecipients.status, "pending")
      )
    )
    .limit(batchSize);

  if (pendingRecipients.length === 0) {
    // No more pending - mark campaign complete
    await db
      .update(emailCampaigns)
      .set({
        status: "sent",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailCampaigns.id, campaignId));

    console.log(`[campaignService] Campaign ${campaignId} completed`);
    return { sent: 0, failed: 0, remaining: 0 };
  }

  let sent = 0;
  let failed = 0;

  const content = campaign.contentJson as CampaignContent;
  const resend = getResendClient();

  for (const recipient of pendingRecipients) {
    // Get subscriber for unsubscribe token
    let unsubscribeToken: string | undefined;
    if (recipient.subscriberId) {
      const [subscriber] = await db
        .select({ token: emailSubscribers.unsubscribeToken })
        .from(emailSubscribers)
        .where(eq(emailSubscribers.id, recipient.subscriberId))
        .limit(1);
      unsubscribeToken = subscriber?.token || undefined;
    }

    const unsubscribeUrl = generateUnsubscribeUrl(recipient.email, unsubscribeToken);

    const html = campaignRenderer.renderCampaignEmail({
      subject: campaign.subject,
      previewText: campaign.previewText || undefined,
      content,
      includeFreeShippingBanner: campaign.includeFreeShippingBanner,
      includePriceMatch: campaign.includePriceMatch,
      utmCampaign: campaign.utmCampaign || undefined,
      unsubscribeUrl,
      recipientEmail: recipient.email,
    });

    if (CAMPAIGN_SAFE_MODE) {
      console.log(`[campaignService] SAFE_MODE - Would send to ${recipient.email}`);
      // Mark as sent in safe mode for testing
      await db
        .update(emailCampaignRecipients)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(emailCampaignRecipients.id, recipient.id));
      sent++;
      continue;
    }

    if (!resend) {
      failed++;
      continue;
    }

    try {
      const fromAddress = campaign.fromName
        ? `${campaign.fromName} <${FROM_EMAIL}>`
        : FROM_EMAIL;

      // Get BCC admin from campaign content metadata
      const contentMeta = campaign.contentJson as any;
      const bccAdmin = contentMeta?._bccAdmin;

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: recipient.email,
        subject: campaign.subject,
        html,
        replyTo: campaign.replyTo || BRAND.email,
        ...(bccAdmin ? { bcc: bccAdmin } : {}),
      });

      if (error) {
        await db
          .update(emailCampaignRecipients)
          .set({
            status: "failed",
            errorMessage: error.message,
          })
          .where(eq(emailCampaignRecipients.id, recipient.id));
        failed++;
        continue;
      }

      // Update recipient as sent
      await db
        .update(emailCampaignRecipients)
        .set({
          status: "sent",
          sentAt: new Date(),
          messageId: data?.id,
        })
        .where(eq(emailCampaignRecipients.id, recipient.id));

      // Log event
      await db.insert(emailCampaignEvents).values({
        campaignId,
        recipientId: recipient.id,
        eventType: "sent",
        email: recipient.email,
        providerEventId: data?.id,
      });

      // Update subscriber's last campaign sent timestamp
      if (recipient.subscriberId) {
        await db
          .update(emailSubscribers)
          .set({ lastCampaignSentAt: new Date() })
          .where(eq(emailSubscribers.id, recipient.subscriberId));
      }

      sent++;
    } catch (err: any) {
      await db
        .update(emailCampaignRecipients)
        .set({
          status: "failed",
          errorMessage: err.message,
        })
        .where(eq(emailCampaignRecipients.id, recipient.id));
      failed++;
    }
  }

  // Update campaign stats
  await db
    .update(emailCampaigns)
    .set({
      sentCount: sql`${emailCampaigns.sentCount} + ${sent}`,
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, campaignId));

  // Count remaining
  const [remainingResult] = await db
    .select({ count: count() })
    .from(emailCampaignRecipients)
    .where(
      and(
        eq(emailCampaignRecipients.campaignId, campaignId),
        eq(emailCampaignRecipients.status, "pending")
      )
    );

  const remaining = Number(remainingResult?.count || 0);

  console.log(`[campaignService] Batch for ${campaignId}: sent=${sent}, failed=${failed}, remaining=${remaining}`);

  return { sent, failed, remaining };
}

// ============================================================================
// Stats
// ============================================================================

/**
 * Get campaign statistics
 */
export async function getCampaignStats(id: string): Promise<CampaignStats | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  // Get recipient status counts
  const statusCounts = await db
    .select({
      status: emailCampaignRecipients.status,
      count: count(),
    })
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.campaignId, id))
    .groupBy(emailCampaignRecipients.status);

  const counts: Record<string, number> = {};
  for (const row of statusCounts) {
    counts[row.status] = Number(row.count);
  }

  // Get event counts
  const eventCounts = await db
    .select({
      eventType: emailCampaignEvents.eventType,
      count: count(),
    })
    .from(emailCampaignEvents)
    .where(eq(emailCampaignEvents.campaignId, id))
    .groupBy(emailCampaignEvents.eventType);

  const events: Record<string, number> = {};
  for (const row of eventCounts) {
    events[row.eventType] = Number(row.count);
  }

  const sent = counts["sent"] || 0 + counts["delivered"] || 0;
  const delivered = events["delivered"] || 0;
  const opened = events["opened"] || 0;
  const clicked = events["clicked"] || 0;
  const bounced = events["bounced"] || 0;
  const complained = events["complained"] || 0;
  const unsubscribed = events["unsubscribed"] || 0;

  return {
    totalRecipients: campaign.totalRecipients,
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    unsubscribed,
    deliveryRate: sent > 0 ? delivered / sent : 0,
    openRate: delivered > 0 ? opened / delivered : 0,
    clickRate: delivered > 0 ? clicked / delivered : 0,
    bounceRate: sent > 0 ? bounced / sent : 0,
    unsubscribeRate: delivered > 0 ? unsubscribed / delivered : 0,
  };
}

// ============================================================================
// Cron Helpers
// ============================================================================

/**
 * Find scheduled campaigns ready to start
 */
export async function findScheduledCampaignsToStart(): Promise<EmailCampaign[]> {
  return db
    .select()
    .from(emailCampaigns)
    .where(
      and(
        eq(emailCampaigns.status, "scheduled"),
        lt(emailCampaigns.scheduledFor, new Date())
      )
    );
}

/**
 * Find sending campaigns that need batch processing
 */
export async function findCampaignsInProgress(): Promise<EmailCampaign[]> {
  return db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.status, "sending"));
}

// ============================================================================
// Exports
// ============================================================================

// ============================================================================
// Audience Building
// ============================================================================

/**
 * Build audience for a campaign (snapshot recipients at send time)
 */
export async function buildAudience(
  campaignId: string
): Promise<{ recipientCount: number; errors: string[] }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return { recipientCount: 0, errors: ["Campaign not found"] };
  }

  const rules = campaign.audienceRulesJson as AudienceRules || {};
  
  // Resolve audience using the audience resolver
  const { subscribers, total } = await audienceResolver.resolveAudience(rules, MAX_RECIPIENTS_PER_CAMPAIGN);

  if (subscribers.length === 0) {
    return { recipientCount: 0, errors: ["No eligible subscribers found"] };
  }

  // Clear existing recipients (in case of rebuild)
  await db
    .delete(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.campaignId, campaignId));

  // Insert recipients
  const recipientRows = subscribers.map(sub => ({
    campaignId,
    subscriberId: sub.id,
    email: sub.email,
    status: "pending" as const,
    vehicleYear: sub.vehicleYear,
    vehicleMake: sub.vehicleMake,
    vehicleModel: sub.vehicleModel,
    vehicleTrim: sub.vehicleTrim,
  }));

  // Batch insert
  const BATCH_SIZE = 500;
  for (let i = 0; i < recipientRows.length; i += BATCH_SIZE) {
    const batch = recipientRows.slice(i, i + BATCH_SIZE);
    await db.insert(emailCampaignRecipients).values(batch);
  }

  // Update campaign with recipient count
  await db
    .update(emailCampaigns)
    .set({
      totalRecipients: subscribers.length,
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, campaignId));

  console.log(`[campaignService] Built audience for ${campaignId}: ${subscribers.length} recipients`);

  return { recipientCount: subscribers.length, errors: [] };
}

/** Maximum recipients per campaign */
const MAX_RECIPIENTS_PER_CAMPAIGN = 50000;

// ============================================================================
// Start Sending with Options
// ============================================================================

/**
 * Start sending a campaign with options (BCC admin, etc.)
 */
export async function startSending(
  campaignId: string,
  options?: {
    bccAdmin?: string;
  }
): Promise<{ sent: number; failed: number }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Store BCC option in campaign metadata
  if (options?.bccAdmin) {
    await db
      .update(emailCampaigns)
      .set({
        contentJson: {
          ...(campaign.contentJson as object),
          _bccAdmin: options.bccAdmin,
        } as any,
        updatedAt: new Date(),
      })
      .where(eq(emailCampaigns.id, campaignId));
  }

  // Mark campaign as sending
  await db
    .update(emailCampaigns)
    .set({
      status: "sending",
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, campaignId));

  // Process batches until done
  let totalSent = 0;
  let totalFailed = 0;
  let remaining = 1; // Start non-zero to enter loop

  while (remaining > 0) {
    const result = await processSendBatch(campaignId, SEND_BATCH_SIZE);
    totalSent += result.sent;
    totalFailed += result.failed;
    remaining = result.remaining;

    // Small delay between batches
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, SEND_BATCH_DELAY_MS));
    }
  }

  return { sent: totalSent, failed: totalFailed };
}

// ============================================================================
// Exports
// ============================================================================

export const campaignService = {
  // CRUD
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  duplicateCampaign,
  deleteCampaign,

  // Scheduling
  scheduleCampaign,
  startCampaignNow,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,

  // Audience
  buildAudience,

  // Sending
  sendTestEmail,
  processSendBatch,
  startSending,

  // Stats
  getCampaignStats,

  // Cron helpers
  findScheduledCampaignsToStart,
  findCampaignsInProgress,

  // Config
  CAMPAIGN_SAFE_MODE,
  SEND_BATCH_SIZE,
};

export default campaignService;
