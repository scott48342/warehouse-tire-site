/**
 * Abandoned Cart Service
 * 
 * Server-side tracking of cart state for recovery and metrics.
 * 
 * Cart states:
 * - active: Has items, user is active
 * - abandoned: No activity for ABANDONMENT_THRESHOLD_MS (default 30 min)
 * - recovered: Order was completed from this cart
 * - expired: No activity for EXPIRY_DAYS (default 7 days)
 * - archived: Manually archived (hidden from default view)
 * 
 * @created 2026-03-25
 * @updated 2026-04-04 - Added lifecycle management
 */

import { db } from "@/lib/fitment-db/db";
import { abandonedCarts, type AbandonedCart, type NewAbandonedCart } from "@/lib/fitment-db/schema";
import { eq, and, lt, gt, or, desc, sql, count, inArray, notInArray, isNull, isNotNull } from "drizzle-orm";
import { detectTestData, type TestDetectionContext } from "@/lib/testData";

// ============================================================================
// Configuration
// ============================================================================

/** Time after last activity before cart is considered abandoned (30 minutes) */
export const ABANDONMENT_THRESHOLD_MS = 30 * 60 * 1000;

/** Days before cart expires (7 days) */
export const EXPIRY_DAYS = 7;

/** Minimum cart value to track (skip empty/tiny carts) */
export const MIN_CART_VALUE = 10;

// ============================================================================
// Types
// ============================================================================

export type CartStatus = "active" | "abandoned" | "recovered" | "expired" | "archived";

export interface CartTrackingData {
  cartId: string;
  sessionId?: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  items: any[];
  subtotal: number;
  estimatedTotal: number;
  source?: string;
  userAgent?: string;
  ipAddress?: string;
  // Test data detection context
  testContext?: Partial<TestDetectionContext>;
  // Explicit test marking
  isTest?: boolean;
  testReason?: string;
}

export interface AbandonedCartStats {
  active: number;
  abandoned: number;
  recovered: number;
  expired: number;
  archived: number;
  abandonedValue: number;
  recoveredValue: number;
  recentAbandoned: AbandonedCart[];
  // Engagement stats
  engagement: {
    emailsSent: number;
    opened: number;
    clicked: number;
    highIntent: number; // clicked but not recovered
  };
  // Funnel metrics
  funnel: {
    totalAbandoned: number;
    emailsSent: number;
    opened: number;
    clicked: number;
    recovered: number;
    openRate: number;  // opened / emailsSent
    clickRate: number; // clicked / opened
    recoveryRate: number; // recovered / abandoned
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Track or update a cart snapshot
 */
export async function trackCart(data: CartTrackingData): Promise<AbandonedCart> {
  const {
    cartId,
    sessionId,
    customer,
    vehicle,
    items,
    subtotal,
    estimatedTotal,
    source,
    userAgent,
    ipAddress,
  } = data;

  // Skip tracking for empty or very low value carts
  if (items.length === 0 || estimatedTotal < MIN_CART_VALUE) {
    // Still return existing cart if any
    const [existing] = await db
      .select()
      .from(abandonedCarts)
      .where(eq(abandonedCarts.cartId, cartId))
      .limit(1);
    if (existing) {
      // Update to mark as expired if was tracked but now empty
      if (items.length === 0) {
        const [updated] = await db
          .update(abandonedCarts)
          .set({
            items: [],
            itemCount: 0,
            subtotal: "0",
            estimatedTotal: "0",
            status: "expired",
            updatedAt: new Date(),
          })
          .where(eq(abandonedCarts.cartId, cartId))
          .returning();
        return updated;
      }
      return existing;
    }
    // Return a minimal object for empty carts (not persisted)
    return {
      id: "",
      cartId,
      sessionId: null,
      customerFirstName: null,
      customerLastName: null,
      customerEmail: null,
      customerPhone: null,
      vehicleYear: null,
      vehicleMake: null,
      vehicleModel: null,
      vehicleTrim: null,
      items: [],
      itemCount: 0,
      subtotal: "0",
      estimatedTotal: "0",
      status: "active",
      recoveredOrderId: null,
      recoveredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      abandonedAt: null,
      source: null,
      userAgent: null,
      ipAddress: null,
    } as AbandonedCart;
  }

  const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);

  // Detect test data
  let isTest = data.isTest || false;
  let testReason = data.testReason || null;

  if (!isTest) {
    const testDetection = detectTestData({
      email: customer?.email,
      ipAddress,
      ...data.testContext,
    });
    if (testDetection.isTest) {
      isTest = true;
      testReason = testDetection.reason;
    }
  }

  // Check if cart exists
  const [existing] = await db
    .select()
    .from(abandonedCarts)
    .where(eq(abandonedCarts.cartId, cartId))
    .limit(1);

  if (existing) {
    // Don't update recovered carts (preserve the recovery record)
    if (existing.status === "recovered") {
      return existing;
    }

    // Update existing cart
    const [updated] = await db
      .update(abandonedCarts)
      .set({
        sessionId: sessionId || existing.sessionId,
        customerFirstName: customer?.firstName || existing.customerFirstName,
        customerLastName: customer?.lastName || existing.customerLastName,
        customerEmail: customer?.email || existing.customerEmail,
        customerPhone: customer?.phone || existing.customerPhone,
        vehicleYear: vehicle?.year || existing.vehicleYear,
        vehicleMake: vehicle?.make || existing.vehicleMake,
        vehicleModel: vehicle?.model || existing.vehicleModel,
        vehicleTrim: vehicle?.trim || existing.vehicleTrim,
        items,
        itemCount,
        subtotal: String(subtotal),
        estimatedTotal: String(estimatedTotal),
        status: "active", // Activity resets to active
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        abandonedAt: null, // Clear abandonment
        source: source || existing.source,
        userAgent: userAgent || existing.userAgent,
        ipAddress: ipAddress || existing.ipAddress,
        // Test data - only upgrade to test, never downgrade
        isTest: isTest || existing.isTest,
        testReason: testReason || existing.testReason,
      })
      .where(eq(abandonedCarts.cartId, cartId))
      .returning();

    return updated;
  }

  // Create new cart
  const [created] = await db
    .insert(abandonedCarts)
    .values({
      cartId,
      sessionId,
      customerFirstName: customer?.firstName,
      customerLastName: customer?.lastName,
      customerEmail: customer?.email,
      customerPhone: customer?.phone,
      vehicleYear: vehicle?.year,
      vehicleMake: vehicle?.make,
      vehicleModel: vehicle?.model,
      vehicleTrim: vehicle?.trim,
      items,
      itemCount,
      subtotal: String(subtotal),
      estimatedTotal: String(estimatedTotal),
      status: "active",
      source,
      userAgent,
      ipAddress,
      // Test data
      isTest,
      testReason,
    })
    .returning();

  return created;
}

/**
 * Mark a cart as recovered when order is completed
 */
export async function markCartRecovered(cartId: string, orderId: string): Promise<AbandonedCart | null> {
  const [existing] = await db
    .select()
    .from(abandonedCarts)
    .where(eq(abandonedCarts.cartId, cartId))
    .limit(1);

  if (!existing) {
    return null;
  }

  const [updated] = await db
    .update(abandonedCarts)
    .set({
      status: "recovered",
      recoveredOrderId: orderId,
      recoveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(abandonedCarts.cartId, cartId))
    .returning();

  console.log(`[AbandonedCart] Cart ${cartId} recovered with order ${orderId}`);
  return updated;
}

/**
 * Process abandoned carts - mark inactive carts as abandoned
 * Returns count of carts marked as abandoned
 */
export async function processAbandonedCarts(): Promise<number> {
  const cutoffTime = new Date(Date.now() - ABANDONMENT_THRESHOLD_MS);
  
  const result = await db
    .update(abandonedCarts)
    .set({
      status: "abandoned",
      abandonedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(abandonedCarts.status, "active"),
        lt(abandonedCarts.lastActivityAt, cutoffTime)
      )
    );

  const affectedCount = (result as any).rowCount || 0;
  if (affectedCount > 0) {
    console.log(`[AbandonedCart] Marked ${affectedCount} carts as abandoned`);
  }
  return affectedCount;
}

/**
 * Expire old carts
 */
export async function expireOldCarts(): Promise<number> {
  const cutoffTime = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  const result = await db
    .update(abandonedCarts)
    .set({
      status: "expired",
      updatedAt: new Date(),
    })
    .where(
      and(
        or(
          eq(abandonedCarts.status, "active"),
          eq(abandonedCarts.status, "abandoned")
        ),
        lt(abandonedCarts.createdAt, cutoffTime)
      )
    );

  const affectedCount = (result as any).rowCount || 0;
  if (affectedCount > 0) {
    console.log(`[AbandonedCart] Expired ${affectedCount} old carts`);
  }
  return affectedCount;
}

/**
 * Get a cart by ID
 */
export async function getCart(cartId: string): Promise<AbandonedCart | null> {
  const [cart] = await db
    .select()
    .from(abandonedCarts)
    .where(eq(abandonedCarts.cartId, cartId))
    .limit(1);
  return cart || null;
}

/**
 * List carts with filters
 */
export type EngagementFilter = "any" | "opened" | "clicked" | "opened-not-clicked" | "high-intent";

export async function listCarts(options: {
  status?: CartStatus | CartStatus[];
  limit?: number;
  offset?: number;
  orderBy?: "lastActivity" | "createdAt" | "value" | "priority";
  /** Include test data (default: false) */
  includeTest?: boolean;
  /** Filter by email engagement level */
  engagement?: EngagementFilter;
}): Promise<{ carts: AbandonedCart[]; total: number }> {
  const { status, limit = 50, offset = 0, orderBy = "priority", includeTest = false, engagement } = options;

  // Build where conditions
  const conditions: any[] = [];
  
  // Status filter
  if (status) {
    if (Array.isArray(status)) {
      conditions.push(or(...status.map(s => eq(abandonedCarts.status, s))));
    } else {
      conditions.push(eq(abandonedCarts.status, status));
    }
  }

  // Exclude test data by default
  if (!includeTest) {
    conditions.push(eq(abandonedCarts.isTest, false));
  }

  // Engagement filter
  if (engagement) {
    switch (engagement) {
      case "opened":
        // Opened at least once
        conditions.push(isNotNull(abandonedCarts.emailOpenedAt));
        break;
      case "clicked":
        // Clicked at least once
        conditions.push(isNotNull(abandonedCarts.emailClickedAt));
        break;
      case "opened-not-clicked":
        // Opened but never clicked (interested but hesitant)
        conditions.push(isNotNull(abandonedCarts.emailOpenedAt));
        conditions.push(isNull(abandonedCarts.emailClickedAt));
        break;
      case "high-intent":
        // Clicked but didn't recover (high intent, needs help)
        conditions.push(isNotNull(abandonedCarts.emailClickedAt));
        conditions.push(eq(abandonedCarts.status, "abandoned"));
        break;
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(where);
  
  const total = Number(countResult?.count || 0);

  // Get carts with ordering
  let carts: AbandonedCart[];
  
  if (orderBy === "priority") {
    // Priority sorting: clicked first, then opened, then high value, then recent
    // Uses computed priority score: clicked=1000, opened=100, then value weight
    carts = await db
      .select()
      .from(abandonedCarts)
      .where(where)
      .orderBy(
        // First: clicked carts (hot leads)
        desc(sql`CASE WHEN ${abandonedCarts.emailClickedAt} IS NOT NULL THEN 1 ELSE 0 END`),
        // Second: opened carts
        desc(sql`CASE WHEN ${abandonedCarts.emailOpenedAt} IS NOT NULL THEN 1 ELSE 0 END`),
        // Third: high value
        desc(abandonedCarts.estimatedTotal),
        // Fourth: recent activity
        desc(abandonedCarts.lastActivityAt)
      )
      .limit(limit)
      .offset(offset);
  } else {
    const orderColumn = 
      orderBy === "value" ? abandonedCarts.estimatedTotal :
      orderBy === "createdAt" ? abandonedCarts.createdAt :
      abandonedCarts.lastActivityAt;

    carts = await db
      .select()
      .from(abandonedCarts)
      .where(where)
      .orderBy(desc(orderColumn))
      .limit(limit)
      .offset(offset);
  }

  return { carts, total };
}

/**
 * Get abandoned cart statistics for dashboard
 * @param includeTest Include test data in stats (default: false)
 */
export async function getStats(includeTest: boolean = false): Promise<AbandonedCartStats> {
  // Process any newly abandoned carts first
  await processAbandonedCarts();
  
  // Base condition: exclude test data unless requested
  const testCondition = includeTest ? undefined : eq(abandonedCarts.isTest, false);
  
  // Count by status (excluding test data)
  const statusCounts = await db
    .select({
      status: abandonedCarts.status,
      count: count(),
    })
    .from(abandonedCarts)
    .where(testCondition)
    .groupBy(abandonedCarts.status);

  const countMap: Record<string, number> = {};
  for (const row of statusCounts) {
    countMap[row.status] = Number(row.count);
  }

  // Sum values for abandoned and recovered (excluding test data)
  const valueConditions = [
    or(
      eq(abandonedCarts.status, "abandoned"),
      eq(abandonedCarts.status, "recovered")
    ),
  ];
  if (!includeTest) {
    valueConditions.push(eq(abandonedCarts.isTest, false));
  }

  const valueResults = await db
    .select({
      status: abandonedCarts.status,
      totalValue: sql<string>`SUM(${abandonedCarts.estimatedTotal})`,
    })
    .from(abandonedCarts)
    .where(and(...valueConditions))
    .groupBy(abandonedCarts.status);

  let abandonedValue = 0;
  let recoveredValue = 0;
  for (const row of valueResults) {
    if (row.status === "abandoned") abandonedValue = Number(row.totalValue || 0);
    if (row.status === "recovered") recoveredValue = Number(row.totalValue || 0);
  }

  // Get recent abandoned carts (excluding test data)
  const recentConditions = [eq(abandonedCarts.status, "abandoned")];
  if (!includeTest) {
    recentConditions.push(eq(abandonedCarts.isTest, false));
  }

  const recentAbandoned = await db
    .select()
    .from(abandonedCarts)
    .where(and(...recentConditions))
    .orderBy(desc(abandonedCarts.abandonedAt))
    .limit(5);

  // Engagement stats
  const engagementConditions = includeTest ? [] : [eq(abandonedCarts.isTest, false)];
  
  const [emailsSentCount] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(and(
      ...engagementConditions,
      gt(abandonedCarts.emailSentCount, 0)
    ));

  const [openedCount] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(and(
      ...engagementConditions,
      isNotNull(abandonedCarts.emailOpenedAt)
    ));

  const [clickedCount] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(and(
      ...engagementConditions,
      isNotNull(abandonedCarts.emailClickedAt)
    ));

  const [highIntentCount] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(and(
      ...engagementConditions,
      isNotNull(abandonedCarts.emailClickedAt),
      eq(abandonedCarts.status, "abandoned")
    ));

  // Count recovered carts that had emails sent
  const [recoveredWithEmailCount] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(and(
      ...engagementConditions,
      eq(abandonedCarts.status, "recovered"),
      gt(abandonedCarts.emailSentCount, 0)
    ));

  // Calculate funnel metrics
  const emailsSent = Number(emailsSentCount?.count || 0);
  const opened = Number(openedCount?.count || 0);
  const clicked = Number(clickedCount?.count || 0);
  const totalAbandoned = (countMap["abandoned"] || 0) + (countMap["recovered"] || 0);
  const recoveredFromEmail = Number(recoveredWithEmailCount?.count || 0);

  return {
    active: countMap["active"] || 0,
    abandoned: countMap["abandoned"] || 0,
    recovered: countMap["recovered"] || 0,
    expired: countMap["expired"] || 0,
    archived: countMap["archived"] || 0,
    abandonedValue,
    recoveredValue,
    recentAbandoned,
    engagement: {
      emailsSent,
      opened,
      clicked,
      highIntent: Number(highIntentCount?.count || 0),
    },
    funnel: {
      totalAbandoned,
      emailsSent,
      opened,
      clicked,
      recovered: recoveredFromEmail,
      openRate: emailsSent > 0 ? Math.round((opened / emailsSent) * 100) : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
      recoveryRate: totalAbandoned > 0 ? Math.round((countMap["recovered"] || 0) / totalAbandoned * 100) : 0,
    },
  };
}

/**
 * Get cart by email (for recovery)
 */
export async function getCartByEmail(email: string): Promise<AbandonedCart | null> {
  const [cart] = await db
    .select()
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.customerEmail, email.toLowerCase()),
        or(
          eq(abandonedCarts.status, "active"),
          eq(abandonedCarts.status, "abandoned")
        )
      )
    )
    .orderBy(desc(abandonedCarts.lastActivityAt))
    .limit(1);
  return cart || null;
}

// ============================================================================
// Lifecycle Management
// ============================================================================

/**
 * Archive a cart (hide from default view)
 */
export async function archiveCart(cartId: string): Promise<AbandonedCart | null> {
  const [updated] = await db
    .update(abandonedCarts)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(abandonedCarts.cartId, cartId))
    .returning();
  
  if (updated) {
    console.log(`[AbandonedCart] Archived cart ${cartId}`);
  }
  return updated || null;
}

/**
 * Restore an archived cart to its previous state (abandoned)
 */
export async function restoreCart(cartId: string): Promise<AbandonedCart | null> {
  const [updated] = await db
    .update(abandonedCarts)
    .set({
      status: "abandoned",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(abandonedCarts.cartId, cartId),
        eq(abandonedCarts.status, "archived")
      )
    )
    .returning();
  
  if (updated) {
    console.log(`[AbandonedCart] Restored cart ${cartId}`);
  }
  return updated || null;
}

/**
 * Hard delete a cart
 */
export async function deleteCart(cartId: string): Promise<boolean> {
  const result = await db
    .delete(abandonedCarts)
    .where(eq(abandonedCarts.cartId, cartId));
  
  const deleted = (result as any).rowCount > 0;
  if (deleted) {
    console.log(`[AbandonedCart] Deleted cart ${cartId}`);
  }
  return deleted;
}

/**
 * Archive all test carts
 */
export async function archiveTestCarts(): Promise<number> {
  const result = await db
    .update(abandonedCarts)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(abandonedCarts.isTest, true),
        notInArray(abandonedCarts.status, ["archived", "recovered"])
      )
    );
  
  const count = (result as any).rowCount || 0;
  console.log(`[AbandonedCart] Archived ${count} test carts`);
  return count;
}

/**
 * Archive all expired carts
 */
export async function archiveExpiredCarts(): Promise<number> {
  const result = await db
    .update(abandonedCarts)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(abandonedCarts.status, "expired"));
  
  const count = (result as any).rowCount || 0;
  console.log(`[AbandonedCart] Archived ${count} expired carts`);
  return count;
}

/**
 * Delete test carts older than X days
 */
export async function deleteOldTestCarts(olderThanDays: number): Promise<number> {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  const result = await db
    .delete(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.isTest, true),
        lt(abandonedCarts.createdAt, cutoffDate)
      )
    );
  
  const count = (result as any).rowCount || 0;
  console.log(`[AbandonedCart] Deleted ${count} test carts older than ${olderThanDays} days`);
  return count;
}

/**
 * Get counts for lifecycle management
 */
export async function getLifecycleCounts(): Promise<{
  testCarts: number;
  expiredCarts: number;
  archivedCarts: number;
}> {
  const [testCount] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.isTest, true),
        notInArray(abandonedCarts.status, ["archived", "recovered"])
      )
    );

  const [expiredCount] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(eq(abandonedCarts.status, "expired"));

  const [archivedCount] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(eq(abandonedCarts.status, "archived"));

  return {
    testCarts: Number(testCount?.count || 0),
    expiredCarts: Number(expiredCount?.count || 0),
    archivedCarts: Number(archivedCount?.count || 0),
  };
}

export const abandonedCartService = {
  trackCart,
  markCartRecovered,
  processAbandonedCarts,
  expireOldCarts,
  getCart,
  listCarts,
  getStats,
  getCartByEmail,
  // Lifecycle management
  archiveCart,
  restoreCart,
  deleteCart,
  archiveTestCarts,
  archiveExpiredCarts,
  deleteOldTestCarts,
  getLifecycleCounts,
  // Constants
  ABANDONMENT_THRESHOLD_MS,
  EXPIRY_DAYS,
  MIN_CART_VALUE,
};

export default abandonedCartService;
