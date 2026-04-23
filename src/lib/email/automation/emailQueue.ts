/**
 * Email Queue Service
 * 
 * Generic queue for scheduled/delayed email sends.
 * Used by automation flows (exit intent, abandoned cart, etc.)
 * 
 * Uses email_subscribers table + a lightweight email_queue for scheduling
 * 
 * @created 2026-04-23
 */

import { db } from "@/lib/fitment-db/db";
import { emailSubscribers, abandonedCarts } from "@/lib/fitment-db/schema";
import { eq, and, lt, isNull, desc, sql } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type AutomationFlow = "exit_intent" | "abandoned_cart" | "cart_save" | "checkout_reminder";

export type EmailStep = "immediate" | "followup_24h" | "followup_48h" | "followup_72h";

export interface QueuedEmail {
  id: string;
  email: string;
  flow: AutomationFlow;
  step: EmailStep;
  sendAt: Date;
  context: {
    vehicleYear?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleTrim?: string;
    cartId?: string;
    cartValue?: number;
    subscriberId?: string;
  };
}

export interface QueueResult {
  queued: boolean;
  reason?: string;
  sendAt?: Date;
}

// ============================================================================
// Queue Management (using email_subscribers metadata)
// ============================================================================

/**
 * Queue an exit intent follow-up email
 * Immediate email is sent synchronously; this queues the 24h follow-up
 */
export async function queueExitIntentFollowup(
  subscriberId: string,
  sendAt: Date
): Promise<QueueResult> {
  try {
    // Update subscriber with scheduled follow-up time
    // We use lastCampaignSentAt as a marker that immediate was sent
    // The cron will check subscribers with source='exit_intent' and send follow-ups
    
    // Note: For now we rely on the existing infrastructure
    // The exit intent follow-up is handled by checking createdAt + 24h
    
    return { queued: true, sendAt };
  } catch (err: any) {
    console.error("[emailQueue] Failed to queue:", err);
    return { queued: false, reason: err.message };
  }
}

/**
 * Find exit intent subscribers due for follow-up email
 * Criteria: source=exit_intent, created > 24h ago, no campaign sent
 */
export async function findExitIntentFollowupsDue(): Promise<Array<{
  id: string;
  email: string;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  cartId: string | null;
  createdAt: Date;
}>> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  const subscribers = await db
    .select({
      id: emailSubscribers.id,
      email: emailSubscribers.email,
      vehicleYear: emailSubscribers.vehicleYear,
      vehicleMake: emailSubscribers.vehicleMake,
      vehicleModel: emailSubscribers.vehicleModel,
      vehicleTrim: emailSubscribers.vehicleTrim,
      cartId: emailSubscribers.cartId,
      createdAt: emailSubscribers.createdAt,
    })
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.source, "exit_intent"),
        eq(emailSubscribers.unsubscribed, false),
        eq(emailSubscribers.marketingConsent, true),
        isNull(emailSubscribers.lastCampaignSentAt), // No follow-up sent yet
        lt(emailSubscribers.createdAt, twentyFourHoursAgo), // Created > 24h ago
        // Don't send if too old (48h window)
        // This is handled by the cron checking createdAt
      )
    )
    .orderBy(desc(emailSubscribers.createdAt))
    .limit(50);

  // Filter to 24-48h window
  return subscribers.filter(s => {
    const created = new Date(s.createdAt).getTime();
    return created > fortyEightHoursAgo.getTime();
  });
}

/**
 * Mark exit intent subscriber as having received follow-up
 */
export async function markExitIntentFollowupSent(subscriberId: string): Promise<void> {
  await db
    .update(emailSubscribers)
    .set({
      lastCampaignSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emailSubscribers.id, subscriberId));
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  exitIntentPending: number;
  abandonedCartPending: {
    first: number;
    second: number;
    third: number;
  };
}> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Exit intent follow-ups pending
  const [exitResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.source, "exit_intent"),
        eq(emailSubscribers.unsubscribed, false),
        eq(emailSubscribers.marketingConsent, true),
        isNull(emailSubscribers.lastCampaignSentAt),
        lt(emailSubscribers.createdAt, twentyFourHoursAgo)
      )
    );

  // Abandoned cart emails pending (from abandonedCartEmail service)
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
  
  const [firstCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.status, "abandoned"),
        eq(abandonedCarts.isTest, false),
        eq(abandonedCarts.unsubscribed, false),
        isNull(abandonedCarts.firstEmailSentAt),
        lt(abandonedCarts.abandonedAt, oneHourAgo)
      )
    );

  const [secondCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.status, "abandoned"),
        eq(abandonedCarts.isTest, false),
        eq(abandonedCarts.unsubscribed, false),
        isNull(abandonedCarts.secondEmailSentAt),
        lt(abandonedCarts.abandonedAt, twentyFourHoursAgo)
      )
    );

  const [thirdCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.status, "abandoned"),
        eq(abandonedCarts.isTest, false),
        eq(abandonedCarts.unsubscribed, false),
        isNull(abandonedCarts.thirdEmailSentAt),
        lt(abandonedCarts.abandonedAt, fortyEightHoursAgo)
      )
    );

  return {
    exitIntentPending: exitResult?.count || 0,
    abandonedCartPending: {
      first: firstCount?.count || 0,
      second: secondCount?.count || 0,
      third: thirdCount?.count || 0,
    },
  };
}

export const emailQueue = {
  queueExitIntentFollowup,
  findExitIntentFollowupsDue,
  markExitIntentFollowupSent,
  getQueueStats,
};

export default emailQueue;
