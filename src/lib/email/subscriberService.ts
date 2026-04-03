/**
 * Email Subscriber Service
 * 
 * Manages email capture for marketing purposes:
 * - Abandoned cart recovery
 * - Newsletter subscriptions
 * - Promotional campaigns
 * 
 * Sources:
 * - exit_intent: Exit-intent popup
 * - cart_save: "Email me this cart" button
 * - checkout: During checkout flow
 * - newsletter: Newsletter signup
 * - quote: Save quote modal
 * 
 * @created 2026-04-03
 */

import { db } from "@/lib/fitment-db/db";
import { emailSubscribers, abandonedCarts, type EmailSubscriber, type NewEmailSubscriber } from "@/lib/fitment-db/schema";
import { eq, and, or, desc, sql, count } from "drizzle-orm";
import { detectTestData, type TestDetectionContext } from "@/lib/testData";

// ============================================================================
// Types
// ============================================================================

export type EmailSource = "exit_intent" | "cart_save" | "checkout" | "newsletter" | "quote";

export interface SubscribeInput {
  email: string;
  source: EmailSource;
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  cartId?: string;
  marketingConsent?: boolean;
  ipAddress?: string;
  userAgent?: string;
  // Test data detection
  testContext?: Partial<TestDetectionContext>;
  isTest?: boolean;
  testReason?: string;
}

export interface SubscriberStats {
  total: number;
  bySource: Record<EmailSource, number>;
  unsubscribed: number;
  withVehicle: number;
  last7Days: number;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Subscribe an email (upsert - updates if same email+source exists)
 */
export async function subscribe(input: SubscribeInput): Promise<EmailSubscriber> {
  const {
    email,
    source,
    vehicle,
    cartId,
    marketingConsent = true,
    ipAddress,
    userAgent,
  } = input;

  const normalizedEmail = email.toLowerCase().trim();

  // Detect test data
  let isTest = input.isTest || false;
  let testReason = input.testReason || null;

  if (!isTest) {
    const testDetection = detectTestData({
      email: normalizedEmail,
      ipAddress,
      ...input.testContext,
    });
    if (testDetection.isTest) {
      isTest = true;
      testReason = testDetection.reason;
    }
  }

  // Check if this email+source combo exists
  const [existing] = await db
    .select()
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.email, normalizedEmail),
        eq(emailSubscribers.source, source)
      )
    )
    .limit(1);

  if (existing) {
    // Update existing record (refresh vehicle, timestamp, etc.)
    const [updated] = await db
      .update(emailSubscribers)
      .set({
        vehicleYear: vehicle?.year || existing.vehicleYear,
        vehicleMake: vehicle?.make || existing.vehicleMake,
        vehicleModel: vehicle?.model || existing.vehicleModel,
        vehicleTrim: vehicle?.trim || existing.vehicleTrim,
        cartId: cartId || existing.cartId,
        marketingConsent: marketingConsent,
        updatedAt: new Date(),
        ipAddress: ipAddress || existing.ipAddress,
        userAgent: userAgent || existing.userAgent,
        // If they're re-subscribing, clear unsubscribed flag
        unsubscribed: false,
        unsubscribedAt: null,
        // Test data - only upgrade to test, never downgrade
        isTest: isTest || existing.isTest,
        testReason: testReason || existing.testReason,
      })
      .where(eq(emailSubscribers.id, existing.id))
      .returning();

    return updated;
  }

  // Create new subscriber
  const [created] = await db
    .insert(emailSubscribers)
    .values({
      email: normalizedEmail,
      source,
      vehicleYear: vehicle?.year,
      vehicleMake: vehicle?.make,
      vehicleModel: vehicle?.model,
      vehicleTrim: vehicle?.trim,
      cartId,
      marketingConsent,
      ipAddress,
      userAgent,
      // Test data
      isTest,
      testReason,
    })
    .returning();

  // If there's a cartId, also update the abandoned cart with this email
  if (cartId) {
    await linkEmailToCart(normalizedEmail, cartId);
  }

  console.log(`[EmailSubscriber] New subscriber: ${normalizedEmail} (source: ${source})`);
  return created;
}

/**
 * Link an email to an abandoned cart
 */
export async function linkEmailToCart(email: string, cartId: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  await db
    .update(abandonedCarts)
    .set({
      customerEmail: normalizedEmail,
      updatedAt: new Date(),
    })
    .where(eq(abandonedCarts.cartId, cartId));

  console.log(`[EmailSubscriber] Linked ${normalizedEmail} to cart ${cartId}`);
}

/**
 * Unsubscribe an email from all marketing
 */
export async function unsubscribe(email: string): Promise<number> {
  const normalizedEmail = email.toLowerCase().trim();

  const result = await db
    .update(emailSubscribers)
    .set({
      unsubscribed: true,
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emailSubscribers.email, normalizedEmail));

  // Also update abandoned carts
  await db
    .update(abandonedCarts)
    .set({
      unsubscribed: true,
      updatedAt: new Date(),
    })
    .where(eq(abandonedCarts.customerEmail, normalizedEmail));

  const affectedCount = (result as any).rowCount || 0;
  console.log(`[EmailSubscriber] Unsubscribed ${normalizedEmail} (${affectedCount} records)`);
  return affectedCount;
}

/**
 * Check if an email is subscribed (not unsubscribed)
 */
export async function isSubscribed(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  const [record] = await db
    .select()
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.email, normalizedEmail),
        eq(emailSubscribers.unsubscribed, false)
      )
    )
    .limit(1);

  return !!record;
}

/**
 * Get all records for an email
 */
export async function getByEmail(email: string): Promise<EmailSubscriber[]> {
  const normalizedEmail = email.toLowerCase().trim();

  return db
    .select()
    .from(emailSubscribers)
    .where(eq(emailSubscribers.email, normalizedEmail))
    .orderBy(desc(emailSubscribers.createdAt));
}

/**
 * Get subscribers for marketing (not unsubscribed, with consent)
 */
export async function getMarketingList(options?: {
  source?: EmailSource;
  hasVehicle?: boolean;
  limit?: number;
  offset?: number;
  /** Include test data (default: false) */
  includeTest?: boolean;
}): Promise<{ subscribers: EmailSubscriber[]; total: number }> {
  const { source, hasVehicle, limit = 100, offset = 0, includeTest = false } = options || {};

  // Build conditions
  const conditions = [
    eq(emailSubscribers.unsubscribed, false),
    eq(emailSubscribers.marketingConsent, true),
  ];

  // Exclude test data by default
  if (!includeTest) {
    conditions.push(eq(emailSubscribers.isTest, false));
  }

  if (source) {
    conditions.push(eq(emailSubscribers.source, source));
  }

  if (hasVehicle) {
    conditions.push(sql`${emailSubscribers.vehicleYear} IS NOT NULL`);
  }

  // Get unique emails (dedupe across sources)
  const subscribers = await db
    .selectDistinctOn([emailSubscribers.email])
    .from(emailSubscribers)
    .where(and(...conditions))
    .orderBy(emailSubscribers.email, desc(emailSubscribers.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(and(...conditions));

  return {
    subscribers,
    total: Number(countResult?.count || 0),
  };
}

/**
 * Get subscriber statistics
 * @param includeTest Include test data in stats (default: false)
 */
export async function getStats(includeTest: boolean = false): Promise<SubscriberStats> {
  // Base condition: exclude test data unless requested
  const testCondition = includeTest ? undefined : eq(emailSubscribers.isTest, false);

  // Total subscribers (unique emails, excluding test)
  const [totalResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(testCondition);

  // By source (excluding test)
  const sourceResults = await db
    .select({
      source: emailSubscribers.source,
      count: count(),
    })
    .from(emailSubscribers)
    .where(testCondition)
    .groupBy(emailSubscribers.source);

  const bySource: Record<string, number> = {};
  for (const row of sourceResults) {
    bySource[row.source] = Number(row.count);
  }

  // Unsubscribed (excluding test)
  const unsubConditions = [eq(emailSubscribers.unsubscribed, true)];
  if (!includeTest) unsubConditions.push(eq(emailSubscribers.isTest, false));

  const [unsubResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(and(...unsubConditions));

  // With vehicle (excluding test)
  const vehicleConditions = [sql`${emailSubscribers.vehicleYear} IS NOT NULL`];
  if (!includeTest) vehicleConditions.push(eq(emailSubscribers.isTest, false));

  const [vehicleResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(and(...vehicleConditions));

  // Last 7 days (excluding test)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentConditions = [sql`${emailSubscribers.createdAt} > ${sevenDaysAgo}`];
  if (!includeTest) recentConditions.push(eq(emailSubscribers.isTest, false));

  const [recentResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emailSubscribers.email})` })
    .from(emailSubscribers)
    .where(and(...recentConditions));

  return {
    total: Number(totalResult?.count || 0),
    bySource: bySource as Record<EmailSource, number>,
    unsubscribed: Number(unsubResult?.count || 0),
    withVehicle: Number(vehicleResult?.count || 0),
    last7Days: Number(recentResult?.count || 0),
  };
}

// ============================================================================
// Export
// ============================================================================

export const subscriberService = {
  subscribe,
  unsubscribe,
  isSubscribed,
  getByEmail,
  getMarketingList,
  getStats,
  linkEmailToCart,
};

export default subscriberService;
