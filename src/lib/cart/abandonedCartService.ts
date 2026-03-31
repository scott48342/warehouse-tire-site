/**
 * Abandoned Cart Service
 * 
 * Server-side tracking of cart state for recovery and metrics.
 * 
 * Cart states:
 * - active: Has items, user is active
 * - abandoned: No activity for ABANDONMENT_THRESHOLD_MS (default 1 hour)
 * - recovered: Order was completed from this cart
 * - expired: Beyond EXPIRY_DAYS (default 30 days)
 * 
 * @created 2026-03-25
 */

import { db } from "@/lib/fitment-db/db";
import { abandonedCarts, type AbandonedCart, type NewAbandonedCart } from "@/lib/fitment-db/schema";
import { eq, and, lt, gt, or, desc, sql, count } from "drizzle-orm";

// ============================================================================
// Configuration
// ============================================================================

/** Time after last activity before cart is considered abandoned (1 hour) */
export const ABANDONMENT_THRESHOLD_MS = 60 * 60 * 1000;

/** Days before cart expires (30 days) */
export const EXPIRY_DAYS = 30;

/** Minimum cart value to track (skip empty/tiny carts) */
export const MIN_CART_VALUE = 10;

// ============================================================================
// Types
// ============================================================================

export type CartStatus = "active" | "abandoned" | "recovered" | "expired";

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
}

export interface AbandonedCartStats {
  active: number;
  abandoned: number;
  recovered: number;
  expired: number;
  abandonedValue: number;
  recoveredValue: number;
  recentAbandoned: AbandonedCart[];
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
export async function listCarts(options: {
  status?: CartStatus | CartStatus[];
  limit?: number;
  offset?: number;
  orderBy?: "lastActivity" | "createdAt" | "value";
}): Promise<{ carts: AbandonedCart[]; total: number }> {
  const { status, limit = 50, offset = 0, orderBy = "lastActivity" } = options;

  // Build where clause
  let where: any = undefined;
  if (status) {
    if (Array.isArray(status)) {
      where = or(...status.map(s => eq(abandonedCarts.status, s)));
    } else {
      where = eq(abandonedCarts.status, status);
    }
  }

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(abandonedCarts)
    .where(where);
  
  const total = Number(countResult?.count || 0);

  // Get carts with ordering
  const orderColumn = 
    orderBy === "value" ? abandonedCarts.estimatedTotal :
    orderBy === "createdAt" ? abandonedCarts.createdAt :
    abandonedCarts.lastActivityAt;

  const carts = await db
    .select()
    .from(abandonedCarts)
    .where(where)
    .orderBy(desc(orderColumn))
    .limit(limit)
    .offset(offset);

  return { carts, total };
}

/**
 * Get abandoned cart statistics for dashboard
 */
export async function getStats(): Promise<AbandonedCartStats> {
  // Process any newly abandoned carts first
  await processAbandonedCarts();
  
  // Count by status
  const statusCounts = await db
    .select({
      status: abandonedCarts.status,
      count: count(),
    })
    .from(abandonedCarts)
    .groupBy(abandonedCarts.status);

  const countMap: Record<string, number> = {};
  for (const row of statusCounts) {
    countMap[row.status] = Number(row.count);
  }

  // Sum values for abandoned and recovered
  const valueResults = await db
    .select({
      status: abandonedCarts.status,
      totalValue: sql<string>`SUM(${abandonedCarts.estimatedTotal})`,
    })
    .from(abandonedCarts)
    .where(or(
      eq(abandonedCarts.status, "abandoned"),
      eq(abandonedCarts.status, "recovered")
    ))
    .groupBy(abandonedCarts.status);

  let abandonedValue = 0;
  let recoveredValue = 0;
  for (const row of valueResults) {
    if (row.status === "abandoned") abandonedValue = Number(row.totalValue || 0);
    if (row.status === "recovered") recoveredValue = Number(row.totalValue || 0);
  }

  // Get recent abandoned carts
  const recentAbandoned = await db
    .select()
    .from(abandonedCarts)
    .where(eq(abandonedCarts.status, "abandoned"))
    .orderBy(desc(abandonedCarts.abandonedAt))
    .limit(5);

  return {
    active: countMap["active"] || 0,
    abandoned: countMap["abandoned"] || 0,
    recovered: countMap["recovered"] || 0,
    expired: countMap["expired"] || 0,
    abandonedValue,
    recoveredValue,
    recentAbandoned,
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

export const abandonedCartService = {
  trackCart,
  markCartRecovered,
  processAbandonedCarts,
  expireOldCarts,
  getCart,
  listCarts,
  getStats,
  getCartByEmail,
  ABANDONMENT_THRESHOLD_MS,
  EXPIRY_DAYS,
  MIN_CART_VALUE,
};

export default abandonedCartService;
