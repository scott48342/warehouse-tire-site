/**
 * Audience Resolver Service
 * 
 * Resolves campaign audience rules into a list of eligible subscribers.
 * Builds a SNAPSHOT of recipients at send time - does NOT dynamically query during batch send.
 * 
 * IMPORTANT: Test data is ALWAYS excluded unless explicitly included.
 * 
 * @created 2026-04-03
 */

import { db } from "@/lib/fitment-db/db";
import {
  emailSubscribers,
  emailCampaignRecipients,
  abandonedCarts,
  type EmailSubscriber,
} from "@/lib/fitment-db/schema";
import { eq, and, or, not, isNull, isNotNull, gte, lte, inArray, sql, count } from "drizzle-orm";
import type { AudienceRules, AudiencePreview } from "./types";

// ============================================================================
// Configuration
// ============================================================================

/** Default days to exclude recent campaign recipients */
const DEFAULT_RECENT_CAMPAIGN_DAYS = 7;

/** Maximum recipients per campaign (safety limit) */
const MAX_RECIPIENTS_PER_CAMPAIGN = 50000;

// ============================================================================
// Audience Resolution
// ============================================================================

/**
 * Build SQL conditions from audience rules
 */
function buildAudienceConditions(rules: AudienceRules): any[] {
  const conditions: any[] = [];
  
  // Always require: subscribed + consented + not suppressed
  conditions.push(eq(emailSubscribers.unsubscribed, false));
  conditions.push(eq(emailSubscribers.marketingConsent, true));
  conditions.push(isNull(emailSubscribers.suppressionReason));
  
  // Exclude test data by default
  if (!rules.includeTest) {
    conditions.push(eq(emailSubscribers.isTest, false));
  }
  
  // Vehicle targeting
  if (rules.vehicleMake) {
    conditions.push(eq(emailSubscribers.vehicleMake, rules.vehicleMake));
  }
  
  if (rules.vehicleModel) {
    conditions.push(eq(emailSubscribers.vehicleModel, rules.vehicleModel));
  }
  
  if (rules.vehicleYearMin) {
    conditions.push(sql`CAST(${emailSubscribers.vehicleYear} AS INTEGER) >= ${rules.vehicleYearMin}`);
  }
  
  if (rules.vehicleYearMax) {
    conditions.push(sql`CAST(${emailSubscribers.vehicleYear} AS INTEGER) <= ${rules.vehicleYearMax}`);
  }
  
  // Source filtering
  if (rules.sources && rules.sources.length > 0) {
    conditions.push(inArray(emailSubscribers.source, rules.sources));
  }
  
  // Activity filter
  if (rules.activeWithinDays) {
    const cutoff = new Date(Date.now() - rules.activeWithinDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(emailSubscribers.lastActiveAt, cutoff));
  }
  
  // Recent campaign exclusion
  const recentDays = rules.recentCampaignExcludeDays ?? DEFAULT_RECENT_CAMPAIGN_DAYS;
  if (recentDays > 0) {
    const cutoff = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);
    conditions.push(
      or(
        isNull(emailSubscribers.lastCampaignSentAt),
        lte(emailSubscribers.lastCampaignSentAt, cutoff)
      )
    );
  }
  
  return conditions;
}

/**
 * Resolve audience for a campaign and return eligible subscribers
 * Returns unique emails only (deduplicated across sources)
 */
export async function resolveAudience(
  rules: AudienceRules,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ subscribers: EmailSubscriber[]; total: number }> {
  const { limit = MAX_RECIPIENTS_PER_CAMPAIGN, offset = 0 } = options || {};
  
  const conditions = buildAudienceConditions(rules);
  
  // Get unique emails with most recent subscriber record
  // Using selectDistinctOn to dedupe by email
  const subscribers = await db
    .selectDistinctOn([emailSubscribers.email])
    .from(emailSubscribers)
    .where(and(...conditions))
    .orderBy(emailSubscribers.email, sql`${emailSubscribers.createdAt} DESC`)
    .limit(limit)
    .offset(offset);
  
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(and(...conditions));
  
  // Filter for hasCart/hasPurchase if specified (requires join)
  let filteredSubscribers = subscribers;
  
  if (rules.hasCart || rules.hasPurchase) {
    const emails = subscribers.map(s => s.email);
    
    if (rules.hasCart && emails.length > 0) {
      // Find emails with abandoned carts
      const cartsResult = await db
        .selectDistinct({ email: abandonedCarts.customerEmail })
        .from(abandonedCarts)
        .where(
          and(
            inArray(abandonedCarts.customerEmail, emails),
            eq(abandonedCarts.status, "abandoned"),
            eq(abandonedCarts.isTest, false)
          )
        );
      
      const emailsWithCart = new Set(cartsResult.map(r => r.email));
      filteredSubscribers = filteredSubscribers.filter(s => emailsWithCart.has(s.email));
    }
    
    if (rules.hasPurchase) {
      // Check lastOrderAt is set
      filteredSubscribers = filteredSubscribers.filter(s => s.lastOrderAt != null);
    }
  }
  
  return {
    subscribers: filteredSubscribers,
    total: Number(countResult?.count || 0),
  };
}

/**
 * Build recipient snapshot for a campaign
 * This creates the email_campaign_recipients records at schedule/send time
 */
export async function buildRecipientSnapshot(
  campaignId: string,
  rules: AudienceRules
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  
  // Resolve audience
  const { subscribers } = await resolveAudience(rules);
  
  if (subscribers.length === 0) {
    return { count: 0, errors: ["No eligible recipients found"] };
  }
  
  // Insert in batches to avoid memory issues
  const BATCH_SIZE = 500;
  let insertedCount = 0;
  
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    
    try {
      await db
        .insert(emailCampaignRecipients)
        .values(
          batch.map(sub => ({
            campaignId,
            subscriberId: sub.id,
            email: sub.email,
            status: "pending" as const,
          }))
        )
        .onConflictDoNothing(); // Skip duplicates
      
      insertedCount += batch.length;
    } catch (err: any) {
      errors.push(`Batch ${i / BATCH_SIZE + 1} error: ${err.message}`);
    }
  }
  
  console.log(`[audienceResolver] Built snapshot for campaign ${campaignId}: ${insertedCount} recipients`);
  
  return { count: insertedCount, errors };
}

/**
 * Get audience preview (for admin UI before scheduling)
 */
export async function getAudiencePreview(rules: AudienceRules): Promise<AudiencePreview> {
  const conditions = buildAudienceConditions(rules);
  
  // Total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(and(...conditions));
  
  const totalCount = Number(countResult?.count || 0);
  
  // Sample emails (anonymized)
  const sampleSubscribers = await db
    .selectDistinctOn([emailSubscribers.email])
    .from(emailSubscribers)
    .where(and(...conditions))
    .limit(10);
  
  const sampleEmails = sampleSubscribers.map(s => {
    const [local, domain] = s.email.split("@");
    const masked = local.slice(0, 2) + "***";
    return `${masked}@${domain}`;
  });
  
  // Breakdown by source
  const sourceResults = await db
    .select({
      source: emailSubscribers.source,
      count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})`,
    })
    .from(emailSubscribers)
    .where(and(...conditions))
    .groupBy(emailSubscribers.source);
  
  const bySource: Record<string, number> = {};
  for (const row of sourceResults) {
    bySource[row.source] = Number(row.count);
  }
  
  // Breakdown by make (top 5)
  const makeResults = await db
    .select({
      make: emailSubscribers.vehicleMake,
      count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})`,
    })
    .from(emailSubscribers)
    .where(and(...conditions, isNotNull(emailSubscribers.vehicleMake)))
    .groupBy(emailSubscribers.vehicleMake)
    .orderBy(sql`COUNT(DISTINCT ${emailSubscribers.email}) DESC`)
    .limit(5);
  
  const byMake: Record<string, number> = {};
  for (const row of makeResults) {
    if (row.make) byMake[row.make] = Number(row.count);
  }
  
  // With vehicle
  const [vehicleCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(and(...conditions, isNotNull(emailSubscribers.vehicleYear)));
  
  // With cart (has an abandoned cart)
  const allEmails = await db
    .selectDistinctOn([emailSubscribers.email], { email: emailSubscribers.email })
    .from(emailSubscribers)
    .where(and(...conditions));
  
  const emailList = allEmails.map(e => e.email);
  
  let withCartCount = 0;
  if (emailList.length > 0) {
    const [cartCount] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${abandonedCarts.customerEmail})` })
      .from(abandonedCarts)
      .where(
        and(
          inArray(abandonedCarts.customerEmail, emailList),
          eq(abandonedCarts.isTest, false)
        )
      );
    withCartCount = Number(cartCount?.count || 0);
  }
  
  // With purchase
  const [purchaseCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(and(...conditions, isNotNull(emailSubscribers.lastOrderAt)));
  
  // Exclusion counts
  const [unsubCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.unsubscribed, true),
        !rules.includeTest ? eq(emailSubscribers.isTest, false) : undefined
      )
    );
  
  const [suppressedCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(
      and(
        isNotNull(emailSubscribers.suppressionReason),
        !rules.includeTest ? eq(emailSubscribers.isTest, false) : undefined
      )
    );
  
  const recentDays = rules.recentCampaignExcludeDays ?? DEFAULT_RECENT_CAMPAIGN_DAYS;
  const cutoff = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);
  const [recentCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(
      and(
        gte(emailSubscribers.lastCampaignSentAt, cutoff),
        !rules.includeTest ? eq(emailSubscribers.isTest, false) : undefined
      )
    );
  
  const [testCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(eq(emailSubscribers.isTest, true));
  
  return {
    totalCount,
    sampleEmails,
    breakdown: {
      bySource,
      byMake,
      withVehicle: Number(vehicleCount?.count || 0),
      withCart: withCartCount,
      withPurchase: Number(purchaseCount?.count || 0),
    },
    exclusions: {
      unsubscribed: Number(unsubCount?.count || 0),
      suppressed: Number(suppressedCount?.count || 0),
      recentCampaign: Number(recentCount?.count || 0),
      test: Number(testCount?.count || 0),
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export const audienceResolver = {
  resolveAudience,
  buildRecipientSnapshot,
  getAudiencePreview,
};

export default audienceResolver;
